import { NextResponse } from "next/server";
import { fetchProducts } from "@/lib/woocommerce";
import { calculateHealthScore } from "@/lib/health-score";
import { getOptimizationHistory } from "@/lib/db";
import { WCProduct } from "@/lib/types";

const MAX_PRODUCTS_TO_SCAN = 300; // cap to keep this fast on shared hosting

export async function GET() {
  try {
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

    const scored = allProducts.map((p) => ({
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

    return NextResponse.json({
      totalProducts: total,
      scannedProducts: allProducts.length,
      avgHealthScore,
      lowScoreProducts: buckets.poor,
      recentOptimizations,
      buckets,
      lowestScoring,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compute analytics" },
      { status: 500 }
    );
  }
}
