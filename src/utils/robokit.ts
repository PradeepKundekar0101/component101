import { load } from "cheerio";
import { SITES } from "../constants";
import { fetchHTMLUsingAxios } from "./fetchHtml";
import crypto from "crypto";
import { normalizeProduct } from "../scrapper";

export async function scrapeRobokit() {
  const products: any = [];
  const html = await fetchHTMLUsingAxios(SITES.ROBOKIT, true);
  if (!html) return products;

  const $ = load(html);
  const mainCategories: any = [];

  $(".subcategory-item").each((_, element) => {
    const link = $(element).find("a").attr("href");
    const name = $(element).find(".subcategory-item__title").text().trim();
    if (link && name) {
      mainCategories.push({ name, url: link });
    }
  });

  for (const category of mainCategories) {
    console.log("category", category.name);
    console.log("category", category.url);

    const categoryHTML = await fetchHTMLUsingAxios(category.url, true);
    if (!categoryHTML) continue;

    // Get subcategories
    const $sub = load(categoryHTML);
    const subcategories: { name: string; url: string }[] = [];

    $sub(".subcategory-item").each((_, element) => {
      const link = $sub(element).find("a").attr("href");
      const name = $sub(element).find(".subcategory-item__title").text().trim();
      console.log("subcategory", name);
      console.log("subcategory", link);
      if (link && name) {
        subcategories.push({ name, url: link });
      }
    });

    // Process each subcategory
    for (const subcategory of subcategories) {
      const subcategoryHTML = await fetchHTMLUsingAxios(subcategory.url, true);
      if (!subcategoryHTML) continue;

      const $prod = load(subcategoryHTML);

      // Use Promise.all to handle async product scraping
      const productPromises = $prod(".pzen-item")
        .map(async (_, element) => {
          const productName = $prod(element)
            .find(".product-name a")
            .text()
            .trim();

          const productUrl = $prod(element)
            .find(".product-name a")
            .attr("href");

          const imageUrl = $prod(element)
            .find(".product__inside__image img")
            .attr("src");

          let price = "";
          let stock = "";
          if (productUrl) {
            const productData = await fetchHTMLUsingAxios(productUrl);
            if (productData) {
              const $prodData = load(productData);
              stock = $prodData(".product-info__availability > strong")
                .text()
                .trim();
              price = $prodData(".product-info__price")
                .text()
                .trim()
                .split(" ")[0]
                .split(".")[0]
                .replace("₹", "")
                .replace(",", "");
            }
          }

          if (productName && productUrl) {
            const objectID = crypto
              .createHash("md5")
              .update(productUrl)
              .digest("hex");

            const productResult = {
              objectID,
              productName,
              productUrl,
              price: price.replace("₽", "").trim(),
              stock: stock.slice(0, stock.length / 2),
              imageUrl,
              category: subcategory.name,
              source: "robokit",
              sourceImage:
                "https://robokits.co.in/includes/templates/robokits/images/uploads/Robokits_Logo_320x80_opt_trns_1587550612.png",
            };
            console.log(productResult);
            return productResult;
          }

          return null;
        })
        .get()
        .filter(Boolean);

      // Wait for all product promises to resolve
      const categoryProducts = await Promise.all(productPromises);
      products.push(...categoryProducts);

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return products.map((product: any) => normalizeProduct(product, "robokit"));
}
