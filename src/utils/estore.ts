import { load } from "cheerio";
import { SITES } from "../constants";
import { Product } from "../types/data";
import { fetchHTMLUsingAxios } from "./fetchHtml";
import crypto from "crypto";

export const scrapeEstore = async () => {
  const products: Product[] = [];
  const url = SITES.ESTORE;

  try {
    const html = await fetchHTMLUsingAxios(url + "/collections/all");

    const $ = load(html);
    const productList = $(".product-grid");
    console.log(productList.length);
    for (const element of productList.get()) {
      try {
        // Extract product details from the grid
        const productName = $(element).find(".card__heading a").text().trim();
        let productUrl = $(element).find(".card__heading a").attr("href") || "";

        // Ensure full URL
        if (productUrl && !productUrl.startsWith("http")) {
          productUrl = `https://www.etstore.in${productUrl}`;
        }

        const imageUrl = $(element).find("img").attr("src") || "";
        const price = $(element)
          .find(".price-item--regular")
          .first()
          .text()
          .trim();
        const isSoldOut =
          $(element).find(".badge--bottom-left").text().trim() === "Sold out";

        // Generate unique ID
        const objectID = crypto
          .createHash("md5")
          .update(productUrl)
          .digest("hex");

        // Fetch individual product page for additional details
        if (productUrl) {
          const productHtml = await fetchHTMLUsingAxios(productUrl);
          const $product = load(productHtml);

          // You can extract additional details from the product page here if needed

          products.push({
            objectID,
            productName,
            productUrl,
            price: price.replace(/[^\d.]/g, ""), // Remove non-numeric characters
            stock: isSoldOut ? "0" : "1",
            imageUrl: imageUrl.startsWith("//")
              ? `https:${imageUrl}`
              : imageUrl,
            category: "electronics", // Update with actual category if available
            source: "estore",
            sourceImage: "https://www.etstore.in/favicon.ico",
          });
          console.log(products[products.length - 1]);

          // Optional: Add delay to prevent overwhelming the server
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (productError) {
        console.error(`Error processing product:`, productError);
      }
    }

    console.log(`Total products scraped: ${products.length}`);
    return products;
  } catch (error) {
    console.error("Error scraping ET Store:", error);
    return products;
  }
};
