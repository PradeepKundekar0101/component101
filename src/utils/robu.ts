import { load } from "cheerio";
import { SITES } from "../constants";
import { fetchHTMLUsingAxios } from "./fetchHtml";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { normalizeProduct } from "../scrapper";

const visitedUrls = new Set<string>();
const MAX_DEPTH = 5;

export async function scrapeRobu() {
  console.log("[INFO] Starting Robu scraping");
  const products: any = [];
  try {
    const html = await fetchHTMLUsingAxios(SITES.ROBU);
    if (!html) {
      console.log("[ERROR] Failed to fetch HTML for main site");
      return products;
    }

    const $ = load(html);
    const categories: { url: string; name: string }[] = [];
    $(".category-card").each((index, element) => {
      const link = $(element).find("a").attr("href");
      const name = $(element)
        .find("a")
        .text()
        .trim()
        .replace(/\n/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (link) {
        categories.push({ url: link, name });
      }
    });

    console.log(`[INFO] Found ${categories.length} main categories`);

    for (const category of categories) {
      console.log(`[INFO] Processing main category: ${category.name}`);
      await processCategory(category.url, category.name, products, 0);
    }
  } catch (error) {
    console.error("[ERROR] Unexpected error in scrapeRobu:", error);
  }

  console.log(`[INFO] Total products scraped: ${products.length}`);
  return products.map((product: any) => normalizeProduct(product, "robu"));
}

async function processCategory(
  url: string,
  categoryPath: string,
  products: any[],
  depth: number
) {
  console.log(
    `[INFO] Entering processCategory: ${categoryPath} at depth ${depth}`
  );
  if (depth >= MAX_DEPTH) {
    console.log(`[WARN] Max depth reached at ${categoryPath}, skipping`);
    return;
  }

  if (visitedUrls.has(url)) {
    console.log(`[WARN] Already visited ${url}, skipping`);
    return;
  }
  visitedUrls.add(url);

  try {
    console.log(
      `[INFO] Processing category at depth ${depth}: ${categoryPath}`
    );
    const html = await fetchHTMLUsingAxios(url);
    if (!html) {
      console.log(`[ERROR] Failed to fetch HTML for category: ${categoryPath}`);
      return;
    }

    const $ = load(html);
    const hasSubcategories = $(".product-category.product").length > 0;

    if (hasSubcategories) {
      const subcategories: Array<{ link: string; name: string }> = [];

      $(".product-category.product").each((_, element) => {
        const link = $(element).find("a").attr("href");
        const name = $(element)
          .find("h2.woocommerce-loop-category__title")
          .text()
          .trim();
        if (link) {
          subcategories.push({ link, name });
        }
      });

      console.log(
        `[INFO] Found ${subcategories.length} subcategories in ${categoryPath}`
      );

      for (const sub of subcategories) {
        const newCategoryPath = `${categoryPath} > ${sub.name}`;
        await processCategory(sub.link, newCategoryPath, products, depth + 1);
      }
    } else {
      console.log(`[INFO] Scraping products in ${categoryPath}`);
      await scrapeSubcategory(url, categoryPath, products);
    }
  } catch (error) {
    console.error(
      `[ERROR] Failed to process category ${categoryPath} at depth ${depth}:`,
      error
    );
  }
}

async function scrapeSubcategory(
  url: string,
  categoryPath: string,
  products: any[]
) {
  let currentPage = 1;
  let hasNextPage = true;
  let totalProductsInCategory = 0;

  console.log(`[INFO] Starting scrapeSubcategory for ${categoryPath}`);

  while (hasNextPage) {
    console.log(`[INFO] Scraping page ${currentPage} of ${categoryPath}`);
    try {
      const pageUrl = currentPage === 1 ? url : `${url}page/${currentPage}/`;
      const subcategoryHTML = await fetchHTMLUsingAxios(pageUrl);
      if (!subcategoryHTML) {
        console.log(`[ERROR] Failed to fetch HTML for ${pageUrl}`);
        break;
      }

      const $prod = load(subcategoryHTML);
      const resultCount = $prod(".woocommerce-result-count").text().trim();
      const isShowingAll = resultCount.includes("Showing all");
      let pageProducts = 0;

      $prod(".product.type-product").map(async (_, element) => {
        try {
          const productName = $prod(element)
            .find(".woocommerce-loop-product__title")
            .text()
            .trim();
          const productUrl = $prod(element)
            .find(".woocommerce-LoopProduct-link")
            .attr("href");

          if (productName && productUrl) {
            const price = $prod(element)
              .find(".woocommerce-Price-amount")
              .text()
              .replace(/[^0-9.]/g, "");
            const imageUrl = $prod(element)
              .find(".attachment-woocommerce_thumbnail")
              .attr("src");

            const productHtml = await fetchHTMLUsingAxios(productUrl);
            if (!productHtml) {
              console.log(
                `[WARN] Failed to fetch product details for ${productUrl}`
              );
              return;
            }

            const $prodData = load(productHtml);
            const stock = $prodData(".electro-stock-availability .stock")
              .text()
              .trim();
            const objectID = crypto
              .createHash("md5")
              .update(productUrl)
              .digest("hex");
            products.push({
              objectID,
              productName: productName.slice(0, productName.length / 2),
              productUrl,
              price,
              stock,
              imageUrl,
              source: "robu",
              category: categoryPath,
              sourceImage:
                "https://robu.in/wp-content/uploads/2020/03/robu-new-logo.png",
            });
            console.log(products[products.length - 1]);
            pageProducts++;
          }
        } catch (error) {
          console.error(
            `[ERROR] Error processing product in ${categoryPath}:`,
            error
          );
        }
      });

      totalProductsInCategory += pageProducts;
      console.log(
        `[INFO] Found ${pageProducts} products on page ${currentPage} of ${categoryPath}`
      );

      if (isShowingAll) {
        hasNextPage = false;
      } else {
        const nextPageLink = $prod(".next.page-numbers").attr("href");
        hasNextPage = !!nextPageLink;
        currentPage++;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(
        `[ERROR] Failed to scrape page ${currentPage} of ${categoryPath}:`,
        error
      );
      hasNextPage = false;
    }
  }

  console.log(
    `[INFO] Total products found in ${categoryPath}: ${totalProductsInCategory}`
  );
}
