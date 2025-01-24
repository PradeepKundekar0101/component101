import { load } from "cheerio";
import { SITES } from "../constants";
import { fetchHTMLUsingAxios } from "./fetchHtml";
import { v4 as uuidv4 } from "uuid";
import { normalizeProduct } from "../scrapper";
import crypto from "crypto";

export async function scrapeZbotic() {
  console.log("Starting scrapeZbotic...");
  const products: any = [];

  try {
    const html = await fetchHTMLUsingAxios(SITES.ZBOTIC);
    if (!html) {
      console.log("Failed to fetch HTML for Zbotic main site.");
      return products;
    }

    const $ = load(html);

    // Get categories
    const categories: { name: string; url: string }[] = [];
    $(".category-grid").map((_, element) => {
      const link = $(element).find("a").attr("href");
      const name = $(element).find("h4").text().trim();
      if (link && name) {
        categories.push({ name, url: link });
      }
    });

    console.log(`Found ${categories.length} categories to scrape.`);

    // Process each category
    for (const category of categories) {
      console.log(`Scraping category: ${category.name}, URL: ${category.url}`);
      await scrapeCategory(category, products);
      console.log(`Finished scraping category: ${category.name}`);
      // Add delay between categories
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(
      `Finished scraping all categories. Total products scraped: ${products.length}`
    );
    return products.map((product: any) => normalizeProduct(product, "zbotic"));
  } catch (error) {
    console.error("An error occurred during scraping:", error);
    return products;
  }
}

async function scrapeCategory(
  category: { name: string; url: string },
  products: any[]
) {
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const pageUrl =
      currentPage === 1 ? category.url : `${category.url}page/${currentPage}/`;

    console.log(`Fetching page ${currentPage} for category: ${category.name}`);

    try {
      const categoryHTML = await fetchHTMLUsingAxios(pageUrl);
      if (!categoryHTML) {
        console.log(`Failed to fetch HTML for category page: ${pageUrl}`);
        break;
      }

      const $prod = load(categoryHTML);

      // Scrape products from current page
      let productsOnPage = 0;
      $prod(".content-product").each((_, element) => {
        const name = $prod(element).find(".product-title a").text().trim();
        const productUrl = $prod(element).find(".product-title a").attr("href");
        const imageUrl = $prod(element)
          .find(".product-content-image img")
          .first()
          .attr("src");
        const price = $prod(element)
          .find(".woocommerce-Price-amount")
          .first()
          .text()
          .trim();

        let stock = "Out of Stock";
        const stockElement = $prod(element).find(".stock");
        if (stockElement.hasClass("in-stock")) {
          stock = stockElement.text().trim();
        }

        if (name && productUrl) {
          const objectID = crypto
            .createHash("md5")
            .update(productUrl)
            .digest("hex");

          products.push({
            objectID,
            productName: name,
            productUrl,
            price: price.replace(/[₹,]/g, "").trim(),
            stock,
            imageUrl,
            category: category.name,
            source: "zbotic",
            sourceImage: "https://zbotic.in/wp-content/uploads/2024/01/l1.png",
          });
          productsOnPage++;
        }
      });

      console.log(
        `Scraped ${productsOnPage} products from page ${currentPage} of category: ${category.name}`
      );

      // Check if there's a next page
      const nextPageLink = $prod(".next.page-numbers").attr("href");
      if (!nextPageLink) {
        hasNextPage = false;
        console.log(`No more pages for category: ${category.name}`);
      } else {
        currentPage++;
        // Add delay between pages to avoid overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(
        `Error occurred while scraping page ${currentPage} of category: ${category.name}:`,
        error
      );
      break;
    }
  }
}
