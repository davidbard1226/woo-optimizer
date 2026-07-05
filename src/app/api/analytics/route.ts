import { NextResponse } from "next/server";
import { fetchProducts } from "@/lib/woocommerce";
import { calculateHealthScore } from "@/lib/health-score";
import { getOptimizationHistory } from "@/lib/db";
import { WCProduct } from "@/lib/types";
import fs from "fs";
import path from "path";

const MAX_PRODUCTS_TO_SCAN = 300;
const CACHE_FILE = path.join(process.cwd(), "data", "products-cache.json");

function updateCache(products: WCProduct[]) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ products }, null, 2), "utf-8");
  } catch {}
}

function readCache(): WCProduct[] {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      const products = Array.isArray(raw) ? raw : raw.products || [];
      if (products.length > 0) return products;
    }
  } catch {}
  return [];
}

function computeStats(products: WCProduct[], total: number) {
  const scored = products.map((p) => ({
    id: p.id,
    name: p.name,
    score: calculateHealthScore(p).total,
  }));

  const buckets = { excellent: 0, good: 0, fair: 0, poor: 0 };
  for (const s of scored) {
    if (s.score >= 80) buckets.excellent++;
    else if (s.score >= 60) buckets.good++;
    else if (s.score >= 40) buckets.fair++;
    else buckets.poor++;
  }

  const avgHealthScore = scored.length
    ? Math.round(scored.reduce((sum, s) => sum + s.score, 0) / scored.length)
    : 0;

  const lowestScoring = [...scored].sort((a, b) => a.score - b.score).slice(0, 10);

  const history = getOptimizationHistory(500);
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentEntries = history.filter((h) => new Date(h.timestamp).getTime() >= dayAgo);
  const recentOptimizations = new Set(recentEntries.map((h) => h.product_id)).size;

  return {
    totalProducts: total,
    scannedProducts: scored.length,
    avgHealthScore,
    lowScoreProducts: buckets.poor,
    recentOptimizations,
    buckets,
    lowestScoring,
    fromCache: false,
  };
}

export async function GET() {
  // Serve cached data immediately
  const cached = readCache();
  if (cached.length > 0) {
    // Background refresh from WooCommerce (fire and forget)
    fetchAllFromWooCommerce().catch(() => {});
    return NextResponse.json({
      ...computeStats(cached, cached.length),
      fromCache: true,
    });
  }

  // No cache yet — try WooCommerce
  try {
    const data = await fetchAllFromWooCommerce();
    return NextResponse.json({ ...data, fromCache: false });
  } catch {
    return NextResponse.json({
      totalProducts: 0,
      scannedProducts: 0,
      avgHealthScore: 0,
      lowScoreProducts: 0,
      recentOptimizations: 0,
      buckets: { excellent: 0, good: 0, fair: 0, poor: 0 },
      lowestScoring: [],
      fromCache: true,
    });
  }
}

async function fetchAllFromWooCommerce() {
  const allProducts: WCProduct[] = [];
  let page = 1;
  let totalPages = 1;
  let total = 0;

  do {
    const result = await fetchProducts({ page, per_page: 100, status: "any" });
    allProducts.push(...result.products);
    total = result.total;
    totalPages = result.totalPages;
    page++;
  } while (page <= totalPages && allProducts.length < MAX_PRODUCTS_TO_SCAN);

  updateCache(allProducts);
  return computeStats(allProducts, total);
}
