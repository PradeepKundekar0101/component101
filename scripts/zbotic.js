import { load } from "cheerio";
import { v4 as uuidv4 } from "uuid";
import { promises as fs } from "fs";

const BASE_URL = "https://zbotic.in/shop/";

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

  $(".category-grid").each((_, element) => {
    if (i == 1) return;
    i++;
    const link = $(element).find("a").attr("href");
    if (link) {
      categories.push({ url: link });
    }
  });

  return categories;
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

  const productElements = $(".content-product").toArray();

  for (const element of productElements) {
    const name = $(element).find(".product-title a").text().trim();
    const productUrl = $(element).find(".product-title a").attr("href");
    const imageUrl = $(element)
      .find(".product-content-image img")
      .first()
      .attr("src");
    const price = $(element)
      .find(".woocommerce-Price-amount")
      .first()
      .text()
      .trim();
    const sku = $(element).find(".sku").text().trim();

    // Get stock status
    let stock = "Out of Stock";
    const stockElement = $(element).find(".stock");
    if (stockElement.hasClass("in-stock")) {
      stock = stockElement.text().trim();
    }

    // Extract numeric price without currency symbol
    const priceValue = price.replace(/[₹,]/g, "").trim();

    const id = uuidv4();

    if (name && productUrl) {
      products.push({
        productName: name,
        price: priceValue,
        imageUrl,
        productUrl,
        stock,
        id,
      });
    }
  }

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

      const products = await getProducts(categoryHTML);
      products.map((p) => {
        if (p !== null) {
          allProducts.push(p);
        }
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Save to JSON file
    await fs.writeFile("zbotic.json", JSON.stringify(allProducts));
    console.log(`Scraping completed. Found ${allProducts.length} products.`);
  } catch (error) {
    console.error("Error during scraping:", error);
  }
}

scrapeWebsite();
