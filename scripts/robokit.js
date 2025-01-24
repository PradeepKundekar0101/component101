import axios from "axios";
import { load } from "cheerio";
import { promises as fs } from "fs";
import { v4 as uuidv4 } from "uuid";
const BASE_URL = "https://robokits.co.in";

async function fetchHTML(url) {
  try {
    const { data } = await axios.get(url);
    return data;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return null;
  }
}

async function getMainCategories(html) {
  let i = 0;
  const $ = load(html);
  const categories = [];

  $(".subcategory-item").each((_, element) => {
    if (i == 2) return;
    i++;
    const link = $(element).find("a").attr("href");
    const name = $(element).find(".subcategory-item__title").text().trim();
    if (link && name) {
      categories.push({ name, url: link });
    }
  });

  return categories;
}

async function getSubCategories(html) {
  let i = 0;
  const $ = load(html);
  const subcategories = [];

  $(".subcategory-item").each((_, element) => {
    if (i == 2) return;
    i++;
    const link = $(element).find("a").attr("href");
    const name = $(element).find(".subcategory-item__title").text().trim();
    if (link && name) {
      subcategories.push({ name, url: link });
    }
  });

  return subcategories;
}

async function getProducts(html) {
  let i = 0;
  const $ = load(html);
  const products = [];

  const productElements = $(".pzen-item").toArray();
  for (const element of productElements) {
    if (i == 2) break;
    i++;

    const productName = $(element).find(".product-name a").text().trim();
    const productUrl = $(element).find(".product-name a").attr("href");
    const imageUrl = $(element).find(".product__inside__image img").attr("src");
    const price = $(element).find(".productBasePrice").text().trim();

    const priceValue = price.replace("₹", "").trim();
    const stock = await getStock(productUrl);
    const id = uuidv4();

    products.push({
      productName,
      price: priceValue,
      imageUrl,
      productUrl,
      stock,
      id,
    });
  }

  return products;
}
async function getStock(url) {
  const html = await fetchHTML(url);
  const $ = load(html);
  const stock = $(".product-info__availability>strong").text().trim();
  return stock.slice(0, stock.length / 2);
}
async function scrapeWebsite() {
  try {
    // Get main page HTML
    const mainPageHTML = await fetchHTML(BASE_URL);
    if (!mainPageHTML) {
      throw new Error("Failed to fetch main page");
    }

    // Get main categories
    const mainCategories = await getMainCategories(mainPageHTML);
    const allProducts = [];

    // Process each main category
    for (const category of mainCategories) {
      console.log(`Processing main category: ${category.name}`);

      // Get category page HTML
      const categoryHTML = await fetchHTML(category.url);
      if (!categoryHTML) continue;

      // Get subcategories
      const subcategories = await getSubCategories(categoryHTML);

      // Process each subcategory
      for (const subcategory of subcategories) {
        console.log(`Processing subcategory: ${subcategory.name}`);

        // Get subcategory page HTML
        const subcategoryHTML = await fetchHTML(subcategory.url);
        if (!subcategoryHTML) continue;

        // Get products
        const products = await getProducts(subcategoryHTML);
        allProducts.push(...products);

        // Add delay to avoid overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    await fs.writeFile("robokit.json", JSON.stringify(allProducts, null, 2));
    console.log(`Scraping completed. Found ${allProducts.length} products.`);
  } catch (error) {
    console.error("Error during scraping:", error);
  }
}

// Run the scraper
scrapeWebsite();
