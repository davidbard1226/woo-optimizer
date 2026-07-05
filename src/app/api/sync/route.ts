import { NextResponse } from "next/server";
import { getSetting } from "@/lib/db";
import fs from "fs";
import path from "path";

const CACHE_FILE = path.join(process.cwd(), "data", "products-cache.json");

function readCache(): Array<Record<string, unknown>> {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      return Array.isArray(raw) ? raw : Array.isArray(raw?.products) ? raw.products : [];
    }
  } catch {}
  return [];
}

function writeCache(products: Array<Record<string, unknown>>) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ products }, null, 2), "utf-8");
  } catch {}
}

function getAuth() {
  const wcUrl = (getSetting("wc_url") || process.env.WC_URL || "").replace(/\/+$/, "");
  const consumerKey = getSetting("wc_consumer_key") || process.env.WC_CONSUMER_KEY || "";
  const consumerSecret = getSetting("wc_consumer_secret") || process.env.WC_CONSUMER_SECRET || "";
  return { wcUrl, consumerKey, consumerSecret };
}

const API_FIELDS = "id,name,slug,permalink,type,status,featured,catalog_visibility,description,short_description,sku,price,regular_price,sale_price,on_sale,purchasable,total_sales,virtual,downloadable,date_created,date_created_gmt,date_modified,date_modified_gmt,stock_status,stock_quantity,manage_stock,categories,tags,images,attributes,average_rating,review_count,weight,dimensions";

async function fetchProductsAfter(afterDate: string) {
  const { wcUrl, consumerKey, consumerSecret } = getAuth();
  if (!wcUrl || !consumerKey || !consumerSecret) throw new Error("WooCommerce not configured");

  const base = `${wcUrl}/wp-json/wc/v3`;
  const all: Array<Record<string, unknown>> = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const params = new URLSearchParams({
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
      per_page: "100",
      page: String(page),
      status: "any",
      after: afterDate,
      orderby: "date_modified",
      order: "asc",
      _fields: API_FIELDS,
    });

    const resp = await fetch(`${base}/products?${params}`, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) throw new Error(`WooCommerce API error (${resp.status})`);
    const products: Array<Record<string, unknown>> = await resp.json();
    all.push(...products);
    totalPages = parseInt(resp.headers.get("X-WP-TotalPages") || "1", 10);
    page++;
  }

  return all;
}

export async function POST() {
  try {
    const cached = readCache();

    // Find the latest date_modified in cache
    let latestDate = "2000-01-01T00:00:00";
    for (const p of cached) {
      const mod = (p.date_modified as string) || (p.date_created as string) || "";
      if (mod > latestDate) latestDate = mod;
    }

    const newProducts = await fetchProductsAfter(latestDate);
    const existingIds = new Set(cached.map((p) => p.id));

    let added = 0;
    let updated = 0;

    for (const p of newProducts) {
      if (existingIds.has(p.id)) {
        // Update existing product
        const idx = cached.findIndex((c) => c.id === p.id);
        if (idx !== -1) cached[idx] = p;
        updated++;
      } else {
        // Append new product
        cached.push(p);
        added++;
      }
    }

    if (added > 0 || updated > 0) {
      writeCache(cached);
    }

    return NextResponse.json({ added, updated, total: cached.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
