import { NextRequest, NextResponse } from "next/server";
import { fetchProducts } from "@/lib/woocommerce";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const result = await fetchProducts({
      page: parseInt(searchParams.get("page") || "1"),
      per_page: parseInt(searchParams.get("per_page") || "20"),
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || "any",
      orderby: searchParams.get("orderby") || "date",
      order: searchParams.get("order") || "desc",
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch products" },
      { status: 500 }
    );
  }
}
