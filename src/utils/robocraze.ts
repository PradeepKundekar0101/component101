import { load } from "cheerio";
import { SITES } from "../constants";
import { fetchHTMLUsingAxios } from "./fetchHtml";
import crypto from "crypto";

export async function scrapeRobocraze() {
  console.log(`Starting Robocraze web scraping process...`);
  const products: any[] = [];
  const categories: any[] = [];
  const baseUrl = `${SITES.ROBOCRAZE}/collections`;

  async function extractCategoriesFromPage(pageUrl: string) {
    console.log(`Fetching categories from page: ${pageUrl}`);
    const html = await fetchHTMLUsingAxios(pageUrl, true);
    if (!html) {
      console.warn(`No HTML content retrieved for page: ${pageUrl}`);
      return [];
    }

    const $ = load(html);
    const pageCategories: any[] = [];

    // Extract categories from collection list
    const collectionCategories = $("li.collection-list__item");
    console.log(`Found ${collectionCategories.length} category candidates`);
    let categoryCount = 0;
    collectionCategories.each((index, element) => {
      const $category = $(element);
      const categoryName = $category
        .find(".card__heading, .full-unstyled-link")
        .first()
        .text()
        .trim()
        .replace(/^-\s*/, "");

      const categoryLink = $category.find("a").first().attr("href");

      if (categoryName && categoryLink) {
        const fullCategoryLink = new URL(categoryLink, baseUrl).href;
        pageCategories.push({
          name: categoryName,
          link: fullCategoryLink,
          source: "robocraze",
        });
        console.log(`Discovered category: ${categoryName}`);
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return pageCategories;
  }

  // Determine total number of pages
  const initialHtml = await fetchHTMLUsingAxios(baseUrl, true);
  if (!initialHtml) return [];

  const $ = load(initialHtml);
  const paginationLinks = $("nav.pagination .pagination__item.link");
  const totalPages =
    paginationLinks.length > 0
      ? Math.max(
          ...paginationLinks.map((i, el) => parseInt($(el).text()) || 0).get()
        )
      : 1;

  console.log(`Total category pages to scrape: ${totalPages}`);

  // Scrape categories from all pages
  for (let page = 1; page <= totalPages; page++) {
    console.log(`Scraping category page ${page}`);
    const pageCategories = await extractCategoriesFromPage(
      `${baseUrl}?page=${page}`
    );

    // Add unique categories
    pageCategories.forEach((category) => {
      if (!categories.some((existing) => existing.name === category.name)) {
        categories.push(category);
      }
    });
  }

  console.log(`Total unique categories discovered: ${categories.length}`);

  for (const category of categories) {
    console.log(`Extracting products from category: ${category.name}`);
    const p = await extractProductsFromCategory(category.link, category.name);
    products.push(...p);
    console.log(`Found ${p.length} products in category ${category.name}`);
  }

  console.log(
    `Scraping completed. Total products collected: ${products.length}`
  );
  return products;
}

const extractProductsFromCategory = async (
  categoryLink: string,
  categoryName: string
): Promise<any[]> => {
  console.log(`Fetching products from category URL: ${categoryLink}`);
  const html = await fetchHTMLUsingAxios(categoryLink, true);
  if (!html) {
    console.warn(`No HTML content retrieved for category: ${categoryName}`);
    return [];
  }

  const $ = load(html);
  const productList = $("li.grid__item");
  const products: any[] = [];

  console.log(
    `Found ${productList.length} product candidates in ${categoryName}`
  );

  productList.map(async (index, element) => {
    const $product = $(element);

    // Extract product name
    const productName = $product.find(".card__heading a").text().trim();

    // Extract product URL
    const productUrl = $product.find(".card__heading a").attr("href");

    // Extract product image
    const productImage = $product.find(".card__media img").first().attr("src");
    let price = "";
    let stock: string | number = "";

    if (productUrl) {
      console.log("productUrl", productUrl);
      const fullProductUrl = new URL(productUrl, SITES.ROBOCRAZE).href;
      const response = await fetchHTMLUsingAxios(fullProductUrl, true);
      if (!response) return;
      const $ = load(response);
      console.log("fullProductUrl", fullProductUrl);
      price = extractPrice($);
      stock = extractStock($);
    }
    console.log("price", price);
    console.log("stock", stock);
    if (productName && productUrl) {
      const fullProductUrl = new URL(productUrl, SITES.ROBOCRAZE).href;
      const fullProductImage = productImage
        ? new URL(productImage, SITES.ROBOCRAZE).href
        : null;
      const objectID = crypto
        .createHash("md5")
        .update(productUrl)
        .digest("hex");
      products.push({
        objectID,
        productName: productName,
        productUrl: fullProductUrl,
        imageUrl: fullProductImage,
        price,
        category: categoryName,
        source: "robocraze",
        stock,
        sourceImage:
          "https://robocraze.com/cdn/shop/files/2_f1a07d5b-b76f-447a-98c4-bfe3eff6348c.png?v=1702463243&width=200",
      });

      console.log(`Processed product: ${productName}`);
    }
  });

  return products;
};

// export async function scrapeRobocrazeProduct(productUrl: string) {
//   console.log(`Fetching product details from: ${productUrl}`);
//   const html = await fetchHTMLUsingAxios(productUrl, true);

//   if (!html) {
//     console.warn(`No HTML content retrieved for product URL: ${productUrl}`);
//     return null;
//   }

//   const $ = load(html);

//   // Extract product name
//   const productName = $(".product__title h1").text().trim();

//   // Extract product image
//   const productImage = $(".product__media-item img").first().attr("src");

//   // Extract price
//   const price = extractPrice($);

//   // Extract category (from breadcrumb)
//   const category = $(".breadcrumbs li")
//     .eq(1) // Second breadcrumb item is usually the category
//     .text()
//     .trim();

//   if (!productName) {
//     console.warn("Could not find product name, skipping product");
//     return null;
//   }

//   const fullProductImage = productImage
//     ? new URL(productImage, SITES.ROBOCRAZE).href
//     : null;

//   const objectID = crypto.createHash("md5").update(productUrl).digest("hex");

//   const product = {
//     objectID,
//     productName,
//     productUrl,
//     imageUrl: fullProductImage,
//     price,
//     category,
//     source: "robocraze",
//     stock: "In Stock",
//     sourceImage:
//       "https://robocraze.com/cdn/shop/files/2_f1a07d5b-b76f-447a-98c4-bfe3eff6348c.png?v=1702463243&width=200",
//   };
//   console.log(product);

//   console.log(`Successfully scraped product: ${productName}`);
//   return product;
// }

// export async function scrapeSingleProduct(productUrl: string) {
//   try {
//     console.log(`Fetching product details from: ${productUrl}`);
//     const html = await fetchHTMLUsingAxios(productUrl, true);

//     if (!html) {
//       console.warn(`No HTML content retrieved for product URL: ${productUrl}`);
//       return null;
//     }

//     const $ = load(html);

//     // Extract product name
//     const productName = $(".product__title h1").text().trim();

//     // Extract product image
//     const productImage = $(".product__media-item img").first().attr("src");

//     // Extract price
//     const price = extractPrice($);

//     // Extract category (from breadcrumb)
//     const category = $(".breadcrumbs li").eq(1).text().trim();

//     if (!productName) {
//       console.warn("Could not find product name, skipping product");
//       return null;
//     }

//     const fullProductImage = productImage
//       ? new URL(productImage, SITES.ROBOCRAZE).href
//       : null;

//     const objectID = crypto.createHash("md5").update(productUrl).digest("hex");

//     const product = {
//       objectID,
//       productName,
//       productUrl,
//       imageUrl: fullProductImage,
//       price,
//       category,
//       source: "robocraze",
//       stock: "In Stock",
//       sourceImage:
//         "https://robocraze.com/cdn/shop/files/2_f1a07d5b-b76f-447a-98c4-bfe3eff6348c.png?v=1702463243&width=200",
//       lastUpdated: new Date().toISOString(),
//     };

//     console.log(`Successfully scraped product: ${productName}`);
//     return product;
//   } catch (error) {
//     console.error(`Error scraping product ${productUrl}:`, error);
//     return null;
//   }
// }

// Helper function to extract price
const extractPrice = ($: any) => {
  // Check for sale price first
  const salePrice = $(".price__sale .price-item--sale")
    .first()
    .text()
    .trim()
    .replace("Rs. ", "");

  // If sale price exists, return it, otherwise get regular price
  if (salePrice) {
    return salePrice;
  }

  return $(".price__regular .price-item--regular")
    .first()
    .text()
    .trim()
    .replace("Rs. ", "");
};
// ... existing code ...

// ... existing code ...

const extractStock = ($: any) => {
  const priceContainer = $(".price--sold-out");
  if (priceContainer.length > 0) {
    return "Sold Out";
  }

  // Then check inventory element
  const inventoryElement = $(".product__inventory");
  if (
    inventoryElement.length === 0 ||
    inventoryElement.css("display") === "none" ||
    !inventoryElement.text().trim()
  ) {
    return "In Stock";
  }

  const stockText = inventoryElement.text().trim();

  // Check for explicit "In stock" text
  if (stockText.toLowerCase().includes("in stock")) {
    return "In Stock";
  }

  // Check for specific number in stock (handles both "X left" and "Low stock: X left")
  const stockMatch = stockText.match(/(\d+)\s+left/);
  return stockMatch ? parseInt(stockMatch[1]) : "In Stock";
};

// ... existing code ...
