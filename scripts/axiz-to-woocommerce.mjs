// Axiz CSV → WooCommerce CSV with AI descriptions + FirstShop images
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";
const AI_MODEL = process.env.AI_MODEL || "nvidia/nemotron-3-nano-30b-a3b:free";

// Config
const BATCH_SIZE = Infinity;  // process all products
const MIN_IMAGES = 3;         // ensure at least this many images
const MAX_IMAGES = 5;         // cap at this many
const PRICE_MARKUP = 1.35;    // 35% markup on cost price, rounded

// ── Read .env.local ──
function loadEnv() {
  try {
    const envFile = path.join(__dirname, "..", ".env.local");
    if (fs.existsSync(envFile)) {
      for (const line of fs.readFileSync(envFile, "utf-8").split("\n")) {
        const m = line.match(/^\s*([^#=]+)=(.+)/);
        if (m) process.env[m[1].trim()] = m[2].trim();
      }
    }
  } catch {}
}
loadEnv();

// ── Read Axiz CSV ──
function readAxizCsv(filePath) {
  let raw = fs.readFileSync(filePath, "utf-8");
  // Strip BOM
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
  const lines = raw.split("\n").filter(Boolean);
  const header = lines[0].split("|").map((h) => h.replace(/^"|"$/g, "").trim());
  const products = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split("|").map((v) => v.replace(/^"|"$/g, "").trim());
    if (vals.length < header.length) continue;
    const p = {};
    header.forEach((h, idx) => { p[h] = vals[idx] || ""; });
    products.push(p);
  }
  return products;
}

// ── Gather Axiz images ──
function getAxizImages(product) {
  const urls = [];
  const keys = ["Image Url", "IMAGEURL2", "IMAGEURL3", "IMAGEURL4", "IMAGEURL5"];
  for (const k of keys) {
    const v = product[k] || "";
    if (v && v.startsWith("http")) urls.push(v);
  }
  return [...new Set(urls)];
}

// ── FirstShop: search by SKU ──
async function searchFirstShop(sku) {
  const url = `https://www.firstshop.co.za/search/suggest.json?q=${encodeURIComponent(sku)}&resources[type]=product`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return null;
    const data = await resp.json();
    const products = data?.resources?.results?.products || [];
    // Find best match — exact SKU in title or URL
    const skuUpper = sku.toUpperCase();
    const match = products.find((p) => p.title.toUpperCase().includes(skuUpper) || p.handle.toUpperCase().includes(skuUpper));
    return match || (products.length > 0 ? products[0] : null);
  } catch {
    return null;
  }
}

// ── FirstShop: get all images for a product ──
async function getFirstShopImages(handle) {
  const url = `https://www.firstshop.co.za/products/${handle}.json`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data?.product?.images || []).map((img) => img.src);
  } catch {
    return [];
  }
}

// ── OpenRouter AI call ──
async function callAI(prompt) {
  if (!OPENROUTER_KEY) return null;
  try {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

// ── AI Prompts ──
function buildBulletPrompt(product) {
  return `Write 3-5 short bullet points for "${product.ITEMNAME}" by ${product.Brand}. 
Each bullet must be under 60 characters. Start each with "* ". 
Focus on key features only. No marketing fluff. No HTML.`;
}

function buildDescriptionPrompt(product, imageCount) {
  const specs = `Brand: ${product.Brand}
Category: ${product.PRODCAT}
Price: R${product.ITEMPRICE}`;
  return `Write an HTML product description for "${product.ITEMNAME}" by ${product.Brand} (SKU: ${product.ITEMID}).

Structure EXACTLY like this:

<p>A short 1-2 sentence summary paragraph describing what the product is and who it's for.</p>

${imageCount >= 1 ? '<p><img src="[IMAGE_URL_1]" alt="' + product.ITEMNAME + '" style="max-width:100%;height:auto" /></p>' : ''}
${imageCount >= 2 ? '<p><img src="[IMAGE_URL_2]" alt="' + product.ITEMNAME + '" style="max-width:100%;height:auto" /></p>' : ''}
${imageCount >= 3 ? '<p><img src="[IMAGE_URL_3]" alt="' + product.ITEMNAME + '" style="max-width:100%;height:auto" /></p>' : ''}

<h3>Technical Specifications</h3>
<ul>
<li>Product: ${product.ITEMNAME}</li>
<li>Brand: ${product.Brand}</li>
<li>SKU: ${product.ITEMID}</li>
<li>Category: ${product.PRODCAT}</li>
</ul>
<p>Add any relevant technical specs here based on the product type and brand.</p>

<h3>What's in the Box</h3>
<ul>
<li>1x ${product.ITEMNAME}</li>
<li>Documentation / Warranty card</li>
</ul>

Requirements:
- Use <p> for paragraphs
- Use <h3> for section headers
- Use <ul>/<li> for lists
- NO asterisks, dashes, or markdown
- Keep the [IMAGE_URL] placeholders as-is
- Replace "Add any relevant technical specs here" with real specs based on the product name
- Replace "Documentation / Warranty card" with actual contents if you can infer them`;
}

// ── Escape CSV field ──
function csvField(val) {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("<")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ── MAIN ──
async function main() {
  const axizPath = "C:\\Users\\David\\Downloads\\AxizCsv.csv";
  if (!fs.existsSync(axizPath)) {
    console.error("AxizCsv.csv not found at:", axizPath);
    process.exit(1);
  }

  console.log("Reading Axiz CSV...");
  const allProducts = readAxizCsv(axizPath);
  const batch = allProducts.slice(0, BATCH_SIZE);
  console.log(`Total in CSV: ${allProducts.length}, processing first ${batch.length}\n`);

  // WooCommerce CSV header
  const headers = [
    "ID", "Type", "SKU", "Name", "Description", "Short description",
    "Regular price", "Categories", "Images", "In stock?", "Brand",
  ];
  const rows = [headers.map((h) => csvField(h)).join(",")];

  for (let i = 0; i < batch.length; i++) {
    const p = batch[i];
    const num = i + 1;
    console.log(`[${num}/${batch.length}] ${p.ITEMID} — ${p.ITEMNAME.slice(0, 60)}...`);

    // Step 1: Get images from Axiz
    let images = getAxizImages(p);
    console.log(`  Axiz images: ${images.length}`);

    // Step 2: Fetch from FirstShop if needed
    if (images.length < MIN_IMAGES) {
      console.log(`  Searching FirstShop for "${p.ITEMID}"...`);
      const match = await searchFirstShop(p.ITEMID);
      if (match) {
        const fsImages = await getFirstShopImages(match.handle);
        for (const url of fsImages) {
          if (!images.includes(url)) images.push(url);
          if (images.length >= MAX_IMAGES) break;
        }
        console.log(`  FirstShop images: ${fsImages.length} (total: ${images.length})`);
      } else {
        console.log(`  No FirstShop match found`);
      }
    }

    // Cap at MAX_IMAGES
    images = images.slice(0, MAX_IMAGES);

    console.log(`  Total images: ${images.length}`);

    // Step 3: Build basic descriptions (no AI model calls — rate limited)
    console.log(`  Building descriptions...`);
    const shortDesc = `<ul><li>${p.ITEMNAME}</li></ul>`;
    let description = `<p>${p.ITEMNAME} by ${p.Brand}. SKU: ${p.ITEMID}.</p>`;
    for (const url of images) {
      description += `<p><img src="${url}" alt="${p.ITEMNAME}" style="max-width:100%;height:auto" /></p>`;
    }
    description += `<h3>Technical Specifications</h3>
<ul>
<li>Product: ${p.ITEMNAME}</li>
<li>Brand: ${p.Brand}</li>
<li>SKU: ${p.ITEMID}</li>
<li>Category: ${p.PRODCAT}</li>
<li>Price: R${p.ITEMPRICE}</li>
</ul>
<h3>What's in the Box</h3>
<ul>
<li>1x ${p.ITEMNAME}</li>
<li>Documentation / Warranty card</li>
</ul>`;
    console.log(`  Done.`);

    // Step 4: Build WooCommerce row
    const imageStr = images.join(",");
    const category = p.PRODCAT || "Uncategorized";
    const stock = parseFloat(p.AVAILTOSELL) > 0 ? "1" : "0";

    const row = [
      "",                          // ID (new)
      "simple",                    // Type
      p.ITEMID,                    // SKU
      p.ITEMNAME.replace(/"/g, "&quot;"),  // Name
      description,                 // Description (HTML)
      shortDesc,                   // Short description (HTML)
      String(Math.round(parseFloat(p.ITEMPRICE) * PRICE_MARKUP)), // Regular price (+35% markup, rounded)
      category,                    // Categories
      imageStr,                    // Images (comma-separated URLs)
      stock,                       // In stock?
      p.Brand,                     // Brand meta
    ];
    rows.push(row.map((v) => csvField(v)).join(","));
  }

  // Write output
  const outPath = path.join(__dirname, "..", "woocommerce-import.csv");
  fs.writeFileSync(outPath, "\uFEFF" + rows.join("\n"), "utf-8"); // BOM for Excel
  console.log(`\n✅ Written to ${outPath} (${batch.length} products)`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
