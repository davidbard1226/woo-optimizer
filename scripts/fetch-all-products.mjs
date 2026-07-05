import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(__dirname, "..", "data", "products-cache.json");

const WC_URL = (process.env.WC_URL || "").replace(/\/+$/, "");
const CONSUMER_KEY = process.env.WC_CONSUMER_KEY || "";
const CONSUMER_SECRET = process.env.WC_CONSUMER_SECRET || "";

if (!WC_URL || !CONSUMER_KEY || !CONSUMER_SECRET) {
  console.error("Missing WC_URL, WC_CONSUMER_KEY, or WC_CONSUMER_SECRET env vars");
  process.exit(1);
}

const FIELDS = [
  "id","name","slug","permalink","type","status","featured","catalog_visibility",
  "description","short_description","sku","price","regular_price","sale_price",
  "on_sale","purchasable","total_sales","virtual","downloadable",
  "date_created","date_created_gmt","date_modified","date_modified_gmt",
  "stock_status","stock_quantity","manage_stock",
  "categories","tags","images","attributes",
  "average_rating","review_count",
  "weight","dimensions",
].join(",");

const BASE = `${WC_URL}/wp-json/wc/v3`;

async function fetchPage(page, perPage) {
  const url = `${BASE}/products?consumer_key=${CONSUMER_KEY}&consumer_secret=${CONSUMER_SECRET}&per_page=${perPage}&page=${page}&status=any&_fields=${FIELDS}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return await resp.json();
}

async function main() {
  console.log("Getting total product count...");
  const url = `${BASE}/products?consumer_key=${CONSUMER_KEY}&consumer_secret=${CONSUMER_SECRET}&per_page=1&page=1&status=any&_fields=id`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed: HTTP ${resp.status}`);
  await resp.json();
  const total = parseInt(resp.headers.get("X-WP-Total") || "0", 10);
  const totalPages = Math.ceil(total / 100);
  console.log(`Total products: ${total}, pages: ${totalPages}\n`);

  const all = [];

  for (let page = 1; page <= totalPages; page++) {
    process.stdout.write(`  Page ${page}/${totalPages}...`);
    try {
      const products = await fetchPage(page, 100);
      all.push(...products);
      console.log(` ${products.length} products (${all.length}/${total})`);
    } catch (err) {
      console.log(` failed: ${err.message}`);
      // Fallback: per_page=1 for each item in this page
      const start = (page - 1) * 100 + 1;
      const end = Math.min(page * 100, total);
      for (let pos = start; pos <= end; pos++) {
        try {
          const p = await fetchPage(pos, 1);
          if (p.length) all.push(p[0]);
        } catch {}
      }
      console.log(`    → ${all.length}/${total} after fallback`);
    }
  }

  console.log(`\nFetched ${all.length}/${total} products`);
  if (all.length > 0) {
    console.log(`Writing to ${CACHE_FILE}...`);
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ products: all }, null, 2), "utf-8");
    console.log("Done!");
  }
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
