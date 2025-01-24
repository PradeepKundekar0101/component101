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

  productList.each((index, element) => {
    const $product = $(element);

    // Extract product name
    const productName = $product.find(".card__heading a").text().trim();

    // Extract product URL
    const productUrl = $product.find(".card__heading a").attr("href");

    // Extract product image
    const productImage = $product.find(".card__media img").first().attr("src");

    // Extract price
    const price = $product
      .find(".price-item--regular")
      .first()
      .text()
      .trim()
      .replace("Rs. ", "");

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
        stock: "In Stock",
        sourceImage:
          "https://robocraze.com/cdn/shop/files/2_f1a07d5b-b76f-447a-98c4-bfe3eff6348c.png?v=1702463243&width=200",
      });

      console.log(`Processed product: ${productName}`);
    }
  });

  return products;
};
