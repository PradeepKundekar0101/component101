import { load } from "cheerio";
import { SITES } from "../../constants";
import { fetchHTMLUsingAxios } from "../fetchHtml";
import crypto from "crypto";

export async function scrapeMakerbazar() {
  console.log("Starting Makerbazar scraping process");

  const baseUrl = `${SITES.MAKERBAZAR}/collections`;
  const categories: Array<{ name: string; url: string }> = [];
  let products: Array<any> = [];
  let currentPage = 1;
  let totalPages = 1;

  try {
    while (currentPage <= 1) {
      console.log(`Scraping page ${currentPage} of categories`);
      const pageUrl =
        currentPage === 1 ? baseUrl : `${baseUrl}?page=${currentPage}`;

      const html = await fetchHTMLUsingAxios(pageUrl);

      if (!html) {
        console.warn(`No HTML content retrieved for page ${currentPage}`);
        break;
      }

      const $ = load(html);
      const categoryElements = $(".grid__cell");

      // Extract pagination information
      const paginationElement = $(".pagination__page-count");
      if (paginationElement.length) {
        const pageText = paginationElement.text().trim();
        const match = pageText.match(/Page \d+ \/ (\d+)/);
        if (match) {
          totalPages = parseInt(match[1], 10);
          console.log(`Total pages discovered: ${totalPages}`);
        }
      }

      categoryElements.each((index, element) => {
        const $category = $(element);
        const categoryName = $category
          .find(".collection-block-item__title")
          .text()
          .trim();
        const categoryLink = $category.find("a").attr("href");

        if (categoryName && categoryLink) {
          categories.push({
            name: categoryName,
            url: `${SITES.MAKERBAZAR}${categoryLink}`,
          });
          console.log(`Found category: ${categoryName}`);
        }
      });

      currentPage++;
    }

    console.log(`Total categories discovered: ${categories.length}`);
    products = await getProductsFromCategories(categories);

    console.log(`Total products scraped: ${products.length}`);
    return products;
  } catch (error) {
    console.error("Error during Makerbazar scraping", error);
    throw error;
  }
}

const getProductsFromCategories = async (
  categories: Array<{ name: string; url: string }>
) => {
  const products: Array<any> = [];
  let count = 0;

  for (const category of categories) {
    if (count > 1) {
      console.log("Reached product limit, stopping scraping");
      break;
    }

    try {
      console.log(`Scraping products for category: ${category.name}`);
      const html = await fetchHTMLUsingAxios(category.url);
      console.log(category.url);
      const $ = load(html);
      console.log("Full HTML structure investigation:");
      console.log("Total number of divs:", $("div").length);

      // Log all divs with class containing 'product'
      console.log("\nDivs with 'product' in class:");
      $("div").each((index, element) => {
        const classes = $(element).attr("class") || "";
        if (classes.includes("product")) {
          console.log(`Class: ${classes}`);
        }
      });

      // Try multiple selector approaches
      console.log("HTML Content Investigation:");
      console.log("HTML Length:", html.length);
      console.log("First 500 characters:", html.substring(0, 500));
      console.log("Last 500 characters:", html.substring(html.length - 500));

      // Check if there are any parsing issues
      console.log("\nCheerio Parsing Check:");
      console.log("Document body exists:", $("body").length);
      console.log(
        "HTML content contains 'boost-sd__product-item':",
        html.includes("boost-sd__product-item")
      );
      const productElements = $(
        ".boost-sd__product-list .boost-sd__product-item"
      );

      productElements.each((index, element) => {
        const $product = $(element);
        const productName = $product
          .find(".boost-sd__product-title")
          .text()
          .trim();
        console.log(productName);
        const price = $product.find(".boost-sd__format-currency").text().trim();
        const productLink = $product
          .find("a.boost-sd__product-link")
          .attr("href");
        const productImage = $product
          .find(".boost-sd__product-image-img")
          .attr("src");

        if (productName && price && productLink && productImage) {
          const productUrl = `${SITES.MAKERBAZAR}${productLink}`;
          const objectID = crypto
            .createHash("md5")
            .update(productUrl)
            .digest("hex");

          const product = {
            objectID,
            productName,
            price,
            productUrl,
            productImage,
            category: category.name,
            source: "makerbazar",
            sourceImage:
              "https://makerbazar.in/cdn/shop/files/makerbazar_dark_logo_updated_5242a7e4-b996-4a1d-831c-9543c3dd3f31_150x@2x.png",
            stock: "In Stock",
          };

          products.push(product);
          console.log(`Scraped product: ${productName}`);
          count++;
        }
      });
    } catch (error) {
      console.error(`Error scraping category ${category.name}`, error);
    }
  }

  return products;
};
