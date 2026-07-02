import { NextRequest, NextResponse } from "next/server";
import { getHistoryForProduct } from "@/lib/db";

export async function GET(request: NextRequest) {
  const productId = parseInt(request.nextUrl.searchParams.get("productId") || "0");
  if (!productId) {
    return NextResponse.json({ error: "productId required" }, { status: 400 });
  }
  const history = getHistoryForProduct(productId, 10);
  return NextResponse.json({ history });
}
