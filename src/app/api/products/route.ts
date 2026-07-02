import { NextRequest, NextResponse } from "next/server";
import { fetchProducts } from "@/lib/woocommerce";

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
      return NextResponse.json(result);
    } catch (fetchErr) {
      if (search && fetchErr instanceof Error && fetchErr.message.includes("500")) {
        const all = await fetchProducts({
          page: 1,
          per_page: 100,
          search: undefined,
          status,
          orderby: "title",
          order: "asc",
        });
        const term = search.toLowerCase();
        const filtered = (all.products || []).filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            (p.sku || "").toLowerCase().includes(term)
        );
        const start = (page - 1) * per_page;
        const paged = filtered.slice(start, start + per_page);
        return NextResponse.json({
          products: paged,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / per_page),
          searchFallback: true,
        });
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
