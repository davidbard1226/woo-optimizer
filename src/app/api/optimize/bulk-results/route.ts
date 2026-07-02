import { NextRequest, NextResponse } from "next/server";
import { getBulkResults, removeBulkResult } from "@/lib/db";

export async function GET() {
  return NextResponse.json({ results: getBulkResults() });
}

export async function DELETE(request: NextRequest) {
  const productId = parseInt(request.nextUrl.searchParams.get("productId") || "0");
  if (!productId) {
    return NextResponse.json({ error: "productId required" }, { status: 400 });
  }
  removeBulkResult(productId);
  return NextResponse.json({ success: true });
}
