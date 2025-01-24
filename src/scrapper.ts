import { promises as fs } from "fs";
import algoliasearch from "algoliasearch";
import dotenv from "dotenv";
import { scrapeRobu } from "./utils/robu";
import { scrapeRobokit } from "./utils/robokit";
import { scrapeZbotic } from "./utils/zbotic";
import { scrapeSunrom } from "./utils/sunrom";
import { scrapeRobocraze } from "./utils/robocraze";

import { scrapeQuartz } from "./utils/quartz";

dotenv.config();

const client = algoliasearch(
  process.env.ALGOLIA_APP_ID!,
  process.env.ALGOLIA_API_KEY!
);

const index = client.initIndex(process.env.ALGOLIA_INDEX_NAME!);

// Normalize product data
export function normalizeProduct(product: any, source: any) {
  return {
    ...product,
    source,
    price: product.price,
    stock: product.stock ? product.stock.toLowerCase() : "",
    lastUpdated: new Date().toISOString(),
  };
}

// Algolia Operations
async function updateAlgoliaProducts(products: any) {
  try {
    const batchSize = 100;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);

      const updates = await Promise.all(
        batch.map(async (product: any) => {
          if (!product.objectID) {
            product.objectID = product.id || `custom_id_${Math.random()}`;
          }

          try {
            const existing: any = await index.getObject(product.objectID);

            // Check if product needs updating
            if (
              existing.price !== product.price ||
              existing.stock !== product.stock
            ) {
              console.log(`Updating product: ${product.productName}`);
              return {
                ...existing,
                imageUrl: product.imageUrl,
                objectID: product.objectID,
                price: product.price,
                stock: product.stock,
                lastUpdated: new Date().toISOString(),
              };
            }
            return null;
          } catch (error) {
            console.log(`New product found: ${product.productName}`);
            return product;
          }
        })
      );

      const filteredUpdates = updates.filter(Boolean);

      if (filteredUpdates.length > 0) {
        console.log("Saving objects to Algolia:");
        await index.saveObjects(filteredUpdates);
        console.log(
          `Updated/Added ${filteredUpdates.length} products in Algolia`
        );
      } else {
        console.log("No updates required for this batch.");
      }
    }
  } catch (error) {
    console.error("Error updating Algolia:", error);
  }
}

// Main scraping function
async function scrapeAll() {
  try {
    console.log("Starting scraping process...", new Date().toISOString());

    // Run all scrapers concurrently
    const [
      robuProducts,
      robokitProducts,
      zboticProducts,
      sunromProducts,
      robocrazeProducts,
      quartzProducts,
    ] = await Promise.all([
      scrapeRobu(),
      scrapeRobokit(),
      scrapeZbotic(),
      scrapeSunrom(),
      scrapeRobocraze(),
      scrapeQuartz(),
    ]);

    const allProducts = [
      ...robuProducts,
      ...robokitProducts,
      ...zboticProducts,
      ...sunromProducts,
      ...robocrazeProducts,
      ...quartzProducts,
    ];

    // Save to local JSON for backup
    const timestamp = new Date().toISOString().split("T")[0];
    await fs.writeFile(
      `products_${timestamp}.json`,
      JSON.stringify(allProducts, null, 2)
    );

    console.log(`Scraped total ${allProducts.length} products`);
    console.log(`- Robu: ${quartzProducts.length}`);
    console.log(`- Robokit: ${robokitProducts.length}`);
    console.log(`- Zbotic: ${zboticProducts.length}`);
    console.log(`- Sunrom: ${sunromProducts.length}`);
    console.log(`- Robocraze: ${robocrazeProducts.length}`);
    // Update Algolia
    await updateAlgoliaProducts(allProducts);

    console.log("Scraping completed successfully");
  } catch (error) {
    console.error("Error during scraping:", error);
  }
}
scrapeAll();
// Export for cron job
export default scrapeAll;
