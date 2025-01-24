import { load } from "cheerio";
import { v4 as uuidv4 } from "uuid";
import { promises as fs } from "fs";

const BASE_URL = "https://robu.in";

async function fetchHTML(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const htmlText = await response.text();
    return htmlText;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return null;
  }
}

async function getCategories(html) {
  const $ = load(html);
  const categories = [];
  let i = 0;

  $(".category-card").each((_, element) => {
    if (i == 1) return;
    i++;
    const link = $(element).find("a").attr("href");
    if (link) {
      categories.push({ url: link });
    }
  });

  return categories;
}

async function getSubCategories(html) {
  const $ = load(html);
  const subcategories = [];
  let i = 0;
  $(".product-category.product").each((_, element) => {
    if (i == 2) return;
    i++;
    const link = $(element).find("a").attr("href");
    if (link) {
      subcategories.push({ url: link });
    }
  });

  return subcategories;
}

async function getProductDetails(productUrl) {
  try {
    const html = await fetchHTML(productUrl);
    if (!html) return null;

    const $ = load(html);
    let stock = $(".robu-stock-q").text().trim();
    if (!stock || stock === "") {
      stock = $(".stock").text().trim();
      stock = stock.slice(0, stock.length / 2);
    }
    return stock;
  } catch (error) {
    console.error(
      `Error fetching product details for ${productUrl}:`,
      error.message
    );
    return null;
  }
}

async function getProducts(html) {
  const $ = load(html);
  const products = [];
  let i = 0;
  const productPromises = $(".product.type-product")
    .map(async (_, element) => {
      if (i == 4) {
        return;
      }
      i++;
      const productName = $(element)
        .find(".woocommerce-loop-product__title")
        .text()
        .trim();
      const productUrl = $(element)
        .find(".woocommerce-LoopProduct-link")
        .attr("href");
      const price = $(element)
        .find(".woocommerce-Price-amount")
        .text()
        .replace(/[^0-9.]/g, "");
      const imageUrl = $(element)
        .find(".attachment-woocommerce_thumbnail")
        .attr("src");

      const stock = await getProductDetails(productUrl);

      return {
        productName,
        productUrl,
        price,
        stock,
        imageUrl,
        id: uuidv4(),
      };
    })
    .get();

  const resolvedProducts = await Promise.all(productPromises);
  resolvedProducts.map((p) => {
    if (p) products.push(p);
  });
  products.push(...resolvedProducts);

  return products;
}

async function scrapeWebsite() {
  try {
    const mainPageHTML = await fetchHTML(BASE_URL);
    if (!mainPageHTML) {
      throw new Error("Failed to fetch main page");
    }

    const categories = await getCategories(mainPageHTML);
    const allProducts = [];

    for (const category of categories) {
      console.log(`Processing category: ${category.url}`);

      const categoryHTML = await fetchHTML(category.url);
      if (!categoryHTML) continue;

      const subcategories = await getSubCategories(categoryHTML);

      for (const subcategory of subcategories) {
        console.log(`Processing subcategory: ${subcategory.url}`);

        const subcategoryHTML = await fetchHTML(subcategory.url);
        if (!subcategoryHTML) continue;

        const products = await getProducts(subcategoryHTML);
        products.map((p) => {
          if (p !== null) {
            allProducts.push(p);
          }
        });

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Save to JSON file
    await fs.writeFile("robu.json", JSON.stringify(allProducts));
    console.log(`Scraping completed. Found ${allProducts.length} products.`);
  } catch (error) {
    console.error("Error during scraping:", error);
  }
}

scrapeWebsite();
