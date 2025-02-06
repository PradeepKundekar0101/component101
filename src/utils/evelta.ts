import { load } from "cheerio";
import { Product } from "../types/data";
import { fetchHTMLUsingAxios } from "./fetchHtml";
import crypto from "crypto";

export const scrapeEvelta = async () => {
  const products: Product[] = [];
  const categories: string[] = [
    "integrated-circuits-ics",
    "boards-kits-and-programmers",
    "drone-parts",
    "breakout-boards",
    "communication",
    "passive-components",
    "sensors",
    "connectors",
    "optoelectronics",
    "electromechanical",
    "discrete-semiconductors",
    "3d-printers-and-filaments",
    "wire-and-cable-management",
    "circuit-protection",
    "power-supplies",
    "test-and-measurement",
    "tools-and-supplies",
  ];

  for (const category of categories) {
    try {
      let currentPage = 1;
      let hasNextPage = true;

      while (hasNextPage) {
        const url = `https://www.evelta.com/${category}/?page=${currentPage}`;
        const html = await fetchHTMLUsingAxios(url);
        const $ = load(html);

        // Check if there are any products on the page
        const pageProducts = $(".card");
        if (pageProducts.length === 0) {
          break;
        }

        pageProducts.each((index, element) => {
          const productName = $(element).find(".card-title a").text().trim();
          const productUrl =
            $(element).find(".card-title a").attr("href") || "";
          const price = $(element).find(".price-primary").text().trim();
          const stock = $(element)
            .find(".card-stock")
            .text()
            .trim()
            .replace(/\D/g, "");
          const imageUrl = $(element).find(".card-image").attr("src") || "";
          const objectID = crypto
            .createHash("md5")
            .update(productUrl)
            .digest("hex");

          if (productName && productUrl) {
            products.push({
              objectID,
              productName,
              productUrl,
              price: price && price.match(/\d+/) ? price.match(/\d+/)![0] : "",
              stock: stock === "" || stock === undefined ? "0" : stock,
              imageUrl,
              category: category.replace("-", " "),
              source: "evelta",
              sourceImage:
                "https://cdn-blog.adafruit.com/uploads/2024/10/Evelta-logo-2.png",
            });
            console.log(products[products.length - 1]);
          }
        });


        const nextButton = $(".pagination-link--next");
        hasNextPage = nextButton.length > 0;

        console.log(`Scraped page ${currentPage} of ${category}`);
        currentPage++;

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log(
        `Completed scraping ${category}. Total products: ${products.length}`
      );
    } catch (error) {
      console.error(`Error scraping category ${category}:`, error);
    }
  }

  return products;
};
