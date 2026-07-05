import { NextRequest, NextResponse } from "next/server";
import { fetchProducts } from "@/lib/woocommerce";
import fs from "fs";
import path from "path";

const CACHE_FILE = path.join(process.cwd(), "data", "products-cache.json");

function readCache(): { products: Array<Record<string, unknown>> } {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      const products = Array.isArray(raw) ? raw : Array.isArray(raw?.products) ? raw.products : [];
      return { products };
    }
  } catch {}
  return { products: [] };
}

function updateCache(products: unknown[]) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({products}, null, 2), "utf-8");
  } catch {}
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const per_page = parseInt(searchParams.get("per_page") || "20");
  const search = searchParams.get("search") || undefined;
  const status = searchParams.get("status") || "any";
  const orderby = searchParams.get("orderby") || "date";
  const order = searchParams.get("order") || "desc";

  // Read cache immediately
  const cached = readCache().products;

  // Background refresh from WooCommerce (fire and forget)
  if (cached.length === 0) {
    try {
      const result = await fetchProducts({ page: 1, per_page: Math.min(per_page, 100), search, status, orderby, order });
      if (!search || result.products.length > 0) updateCache(result.products);
      return NextResponse.json({ ...result, fromCache: false });
    } catch {
      return NextResponse.json({ products: [], total: 0, totalPages: 0, fromCache: true });
    }
  }

  // Filter from cache
  let filtered = cached;
  if (search) {
    const term = search.toLowerCase();
    filtered = cached.filter(
      (p) =>
        ((p.name || "") as string).toLowerCase().includes(term) ||
        ((p.sku || "") as string).toLowerCase().includes(term)
    );
  }

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (orderby === "title") cmp = ((a.name || "") as string).localeCompare((b.name || "") as string);
    else if (orderby === "price") cmp = (parseFloat(a.price as string) || 0) - (parseFloat(b.price as string) || 0);
    else cmp = ((a.date_created || "") as string).localeCompare((b.date_created || "") as string);
    return order === "asc" ? cmp : -cmp;
  });

  const start = (page - 1) * per_page;

  // Background refresh from WooCommerce (paginate all pages)
  if (!search && status === "any") {
    (async () => {
      try {
        const all: Array<Record<string, unknown>> = [];
        let p = 1;
        let totalPages = 1;
        while (p <= totalPages) {
          const result = await fetchProducts({ page: p, per_page: 100, status: "any", orderby: "title", order: "asc" });
          all.push(...result.products);
          totalPages = result.totalPages;
          p++;
        }
        if (all.length) updateCache(all);
      } catch {}
    })();
  }

  return NextResponse.json({
    products: sorted.slice(start, start + per_page),
    total: filtered.length,
    totalPages: Math.ceil(filtered.length / per_page),
    fromCache: true,
  });
}
