import { load } from "cheerio";
import { SITES } from "../constants";
import crypto from "crypto";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const scrapeQuartz = async () => {
  const categories: string[] = [
    "robotics",
    "components",
    "development-boards",
    "displays",
    "sensors",
    "wireless",
    "audio",
    "modules",
    "ics",
    "power",
    "power-batteries",
    "motors",
    "switches-connectors",
    "soldering",
    "mechanical-tool",
    "test-measurement",
    "smd-components",
    "wires-cables",
    "3D-printer-parts",
    "drone-components",
  ];

  const products: any[] = [];
  const seenTitles = new Set<string>(); // Track seen product titles

  for (const category of categories) {
    const url = `${SITES.QUARTZ}/collections/${category}`;
    const categoryPage = await fetch(url);
    const categoryPageText = await categoryPage.text();
    const $ = load(categoryPageText);

    const subCategories: any[] = [];

    // Extract subcategories
    $(".subcat-grid-link").each((_, element) => {
      const link = $(element).attr("href");
      const title = $(element).find(".subcat-grid-link__title").text().trim();
      if (link && title) {
        subCategories.push({
          category,
          title: title.split("(")[0].trim(),
          link: `${SITES.QUARTZ}${link}`,
        });
      }
    });

    // Process each subcategory
    for (const subcat of subCategories) {
      let currentPageUrl = subcat.link;

      // Loop through all pages
      while (currentPageUrl) {
        const subcatPage = await fetch(currentPageUrl);
        const subcatPageText = await subcatPage.text();
        const $$ = load(subcatPageText);

        // Scrape product data from the current page
        const pagePromises = $$(".product-card")
          .map(async (_, productElement) => {
            const productTitle = $$(productElement)
              .find(".product-title a")
              .text()
              .trim();

            // Skip if we've already seen this product title
            if (seenTitles.has(productTitle)) {
              return;
            }

            // Add the title to our set of seen titles
            seenTitles.add(productTitle);

            const productLink =
              SITES.QUARTZ +
              $$(productElement).find(".product-title a").attr("href");
            const [stock, productImage] = await getStock(productLink);
            const productPrice =
              $$(productElement).find(".price-item--sale").text().trim() ||
              $$(productElement).find(".price-item--regular").text().trim();

            const priceNumber = productPrice.replace(/[^\d]/g, "").slice(0, -2);

            await delay(500);

            const objectID = crypto
              .createHash("md5")
              .update(productLink)
              .digest("hex");

            products.push({
              stock,
              objectID,
              productName: productTitle,
              productUrl: productLink,
              price: priceNumber,
              imageUrl: productImage?.startsWith("//")
                ? `https:${productImage}`
                : productImage,
              category: subcat.title,
              source: "quartz",
              sourceImage:
                "https://quartzcomponents.com/cdn/shop/files/358x92.png",
            });
          })
          .get();

        // Wait for all products on the page to be processed
        await Promise.all(pagePromises);

        // Log the last processed product
        if (products.length > 0) {
          console.log(products[products.length - 1]);
        }

        // Check if there's a "Next" button in the pagination
        const nextPageLink = $$(".btn--next").attr("href");
        currentPageUrl = nextPageLink ? `${SITES.QUARTZ}${nextPageLink}` : null;
      }
    }
  }

  return products;
};

const getStock = async (productLink: string) => {
  const productPage = await fetch(productLink);
  const productPageText = await productPage.text();
  const $ = load(productPageText);
  const stock = $(".product_inventory span").text().trim().split(" ")[0];
  const productImage = $(
    ".product-single__photo img.product-featured-img"
  ).attr("src");
  return [stock, productImage];
};
