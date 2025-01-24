import cron from "node-cron";
import scrapeAll from "./scrapper";

cron.schedule("0 2 * * *", async () => {
  console.log("Starting scheduled scraping job:", new Date().toISOString());
  await scrapeAll();
});

scrapeAll();
