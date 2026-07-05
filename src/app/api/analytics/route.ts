import { NextResponse } from "next/server";
import { calculateHealthScore } from "@/lib/health-score";
import { getOptimizationHistory } from "@/lib/db";
import { WCProduct } from "@/lib/types";
import fs from "fs";
import path from "path";

const CACHE_FILE = path.join(process.cwd(), "data", "products-cache.json");

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
  const cached = readCache();
  if (cached.length > 0) {
    return NextResponse.json({
      ...computeStats(cached, cached.length),
      fromCache: true,
    });
  }

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
