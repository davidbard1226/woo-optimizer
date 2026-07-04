import { NextRequest, NextResponse } from "next/server";
import { fetchProducts } from "@/lib/woocommerce";
import fs from "fs";
import path from "path";

const CACHE_FILE = path.join(process.cwd(), "data", "products-cache.json");

function updateCache(products: unknown[]) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(products, null, 2), "utf-8");
  } catch {}
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const per_page = parseInt(searchParams.get("per_page") || "20");
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || "any";
    const orderby = searchParams.get("orderby") || "date";
    const order = searchParams.get("order") || "desc";

    try {
      const result = await fetchProducts({
        page,
        per_page,
        search,
        status,
        orderby,
        order,
      });
      if (!search && page === 1) {
        updateCache(result.products);
      }
      return NextResponse.json(result);
    } catch (fetchErr) {
      // On search failure, try reading from persistent cache
      if (search) {
        try {
          const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
          const cached = Array.isArray(raw) ? raw : raw.products || [];
          const term = search.toLowerCase();
          const filtered = cached.filter(
            (p: { name?: string; sku?: string }) =>
              (p.name || "").toLowerCase().includes(term) ||
              (p.sku || "").toLowerCase().includes(term)
          );
          const start = (page - 1) * per_page;
          return NextResponse.json({
            products: filtered.slice(start, start + per_page),
            total: filtered.length,
            totalPages: Math.ceil(filtered.length / per_page),
            searchFallback: true,
          });
        } catch {}
      }
      throw fetchErr;
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch products" },
      { status: 500 }
    );
  }
}
