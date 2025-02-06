import { load } from "cheerio";
import { SITES } from "../constants";
import { Product } from "../types/data";
import { fetchHTMLUsingAxios } from "./fetchHtml";
import crypto from "crypto";

export const scrapeSunrom = async () => {
  const products: Product[] = [];
  const categories = [
    "embedded-solutions",
    "connectors",
    "switches",
    "passive-components",
    "active-components",
    "power-supply",
    "optoelectronics",
    "prototyping-testing",
    "circuit-protection",
    "hardware-1",
    "machine-tools",
  ];
  const url = SITES.SUNROM;
  const subCategories: { url: string; name: string }[] = [];

  console.log("Starting Sunrom scraper...");
  console.log(`Total categories to process: ${categories.length}`);

  // Fetch subcategories
  for (const category of categories) {
    console.log(`Fetching subcategories for category: ${category}`);
    const html = await fetchHTMLUsingAxios(`${url}/c/${category}`, true);
    const $ = load(html);

    $(".panel-body .row div").each((_, subCategory) => {
      const subCategoryUrl = $(subCategory).find("a").attr("href");
      if (subCategoryUrl) {
        const fullSubcategoryUrl = url + subCategoryUrl;
        subCategories.push({ url: fullSubcategoryUrl, name: category });
        console.log(`Found subcategory: ${fullSubcategoryUrl}`);
      }
    });
  }

  console.log(`Total subcategories found: ${subCategories.length}`);

  // Scrape products with pagination
  for (const subCategory of subCategories) {
    console.log(`Processing subcategory: ${subCategory.url}`);

    let currentPage = 1;
    let hasNextPage = true;
    let totalProductsInSubcategory = 0;

    while (hasNextPage) {
      // Construct URL with pagination
      const pageUrl = `${subCategory.url}?page=${currentPage}&per-page=48`;
      console.log(`Scraping page: ${pageUrl}`);

      const html = await fetchHTMLUsingAxios(pageUrl, true);
      const $ = load(html);

      // Find product URLs on current page
      const productUrlList = $(".category-index a.thumbnail").get();

      // Break if no products found
      if (productUrlList.length === 0) {
        console.log(
          `No more products found on page ${currentPage}. Ending pagination.`
        );
        break;
      }

      console.log(
        `Found ${productUrlList.length} products on page ${currentPage}`
      );

      // Scrape individual product details
      for (const productUrl of productUrlList) {
        if (productUrl && productUrl.attribs.href) {
          const fullProductUrl = url + productUrl.attribs.href;
          console.log(`Scraping product details: ${fullProductUrl}`);

          const productHtml = await fetchHTMLUsingAxios(fullProductUrl, true);
          const $product = load(productHtml);

          const productName = $product("h1").first().text().trim();
          const productImage = $product("#main_img").attr("src") || "";
          const priceString = $product(".panel-footer span.label-product")
            .text()
            .trim();
          const price = parseInt(priceString.replace(/[^\d]/g, ""), 10) / 100;
          const stock = $product(".leadtime > b").text().trim();

          const product = {
            productUrl: fullProductUrl,
            productName,
            imageUrl: productImage.startsWith("http")
              ? productImage
              : url + productImage,
            price: price + "",
            objectID: crypto
              .createHash("md5")
              .update(fullProductUrl)
              .digest("hex"),
            stock,
            category: subCategory.name.replace("-", " "),
            source: "sunrom",
            sourceImage: "https://www.sunrom.com/css/logo.gif",
          };
          console.log(product);
          products.push(product as Product);
          totalProductsInSubcategory++;

          console.log(
            `Scraped product: ${productName}, Price: ${product.price}, Stock: ${stock}`
          );
        }
      }

      // Check for next page
      const pagination = $("ul.pagination");
      const nextPageLink = pagination.find("li.next a");

      // If no next page link or it's disabled, stop pagination
      if (
        nextPageLink.length === 0 ||
        nextPageLink.parent().hasClass("disabled")
      ) {
        console.log(
          `No more pages for subcategory. Total products scraped: ${totalProductsInSubcategory}`
        );
        hasNextPage = false;
      } else {
        currentPage++;
        console.log(`Moving to next page: ${currentPage}`);
      }
    }
  }

  console.log(
    `Total products scraped across all categories: ${products.length}`
  );
  return products;
};
