import axios from "axios";
import { load } from "cheerio";
import { promises as fs } from "fs";

// Base URL for the website
const BASE_URL = "https://www.sunrom.com";

async function getAllProducts() {
  const products = [];
  let currentPage = 1;
  let hasNextPage = true;

  try {
    while (hasNextPage) {
      console.log(`Scraping page ${currentPage}...`);

      const url = `${BASE_URL}/c/products?page=${currentPage}&per-page=48`;
      const response = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });

      const $ = load(response.data);

      // Extract products from current page
      $(".thumbnail").each((_, element) => {
        const $el = $(element);
        const product = {
          price: $el.find(".pprice").text().trim(),
          name: $el.find(".pname").text().trim(),
          imageUrl: BASE_URL + $el.find("img").attr("src"),
          productUrl: BASE_URL + $el.attr("href"),
          source: "sunrom",
        };
        products.push(product);
      });

      // Check if there's a next page
      hasNextPage =
        $(".pagination .next").length > 0 &&
        !$(".pagination .next").hasClass("disabled");

      // Add delay to avoid overwhelming the server
      await new Promise((resolve) => setTimeout(resolve, 2000));

      currentPage++;
    }

    // Save products to JSON file
    await fs.writeFile(
      "sunrom_products.json",
      JSON.stringify(products, null, 2)
    );
    console.log(
      `Successfully scraped ${products.length} products and saved to sunrom_products.json`
    );
  } catch (error) {
    console.error("Error occurred while scraping:", error.message);

    // Save whatever products we managed to scrape before the error
    if (products.length > 0) {
      await fs.writeFile(
        "sunrom_products_partial.json",
        JSON.stringify(products, null, 2)
      );
      console.log(
        `Saved ${products.length} products to sunrom_products_partial.json before error occurred`
      );
    }
  }
}

getAllProducts();
