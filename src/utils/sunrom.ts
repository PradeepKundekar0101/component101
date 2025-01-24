import { load } from "cheerio";
import { SITES } from "../constants";
import { fetchHTMLUsingAxios } from "./fetchHtml";
import { normalizeProduct } from "../scrapper";
import crypto from "crypto";

export async function scrapeSunrom() {
  console.log(`Starting Sunrom web scraping process...`);
  const products: any[] = [];
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const url = `${SITES.SUNROM}/c/products?page=${currentPage}&per-page=48`;
    console.log(`Fetching page: ${url}`);

    const html = await fetchHTMLUsingAxios(url, true);
    if (!html) {
      console.warn(
        `No HTML content retrieved for page ${currentPage}. Stopping scraping.`
      );
      hasNextPage = false;
      break;
    }

    const $ = load(html);
    const productElements = $(".thumbnail");
    console.log(
      `Found ${productElements.length} product thumbnails on page ${currentPage}`
    );

    for (const element of productElements.get()) {
      const $el = $(element);
      const productPath = $el.attr("href");

      if (!productPath) {
        console.warn(`Skipping product: No product path found`);
        continue;
      }

      const objectID = crypto
        .createHash("md5")
        .update(SITES.SUNROM + productPath)
        .digest("hex");

      try {
        const productData = await fetchHTMLUsingAxios(
          SITES.SUNROM + productPath
        );

        if (!productData) {
          console.warn(`Failed to fetch product data for path: ${productPath}`);
          continue;
        }

        const $prodData = load(productData);
        const stock = $prodData(".leadtime b:first-child").text().trim();

        function normalizePrice(priceText: string): number {
          return parseFloat(
            priceText.replace("Rs.", "").replace("/-", "").trim()
          );
        }

        const product = {
          objectID,
          productName: $el.find(".pname").text().trim(),
          price: normalizePrice($el.find(".pprice").text().trim()),
          imageUrl: SITES.SUNROM + $el.find("img").attr("src"),
          productUrl: SITES.SUNROM + productPath,
          stock: stock,
          source: "sunrom",
          sourceImage: "https://www.sunrom.com/css/logo_sm.png",
          category: "Unknown",
        };

        if (stock && stock !== "") {
          products.push(normalizeProduct(product, "sunrom"));
          console.log(`Successfully processed product: ${product.productName}`);
        } else {
          console.log(`Skipping out-of-stock product: ${product.productName}`);
        }
      } catch (error) {
        console.error(`Error fetching product ${productPath}:`, error);
      }
    }

    // Check for next page
    hasNextPage =
      $(".pagination .next").length > 0 &&
      !$(".pagination .next").hasClass("disabled");

    if (!hasNextPage) {
      console.log(`No more pages to scrape. Current page was ${currentPage}.`);
      break;
    }

    currentPage++;
    console.log(`Moving to next page: ${currentPage}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(
    `Scraping completed. Total products collected: ${products.length}`
  );
  return products;
}
