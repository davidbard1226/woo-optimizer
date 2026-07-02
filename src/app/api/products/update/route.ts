import { NextRequest, NextResponse } from "next/server";
import { updateProduct } from "@/lib/woocommerce";
import { addOptimizationHistory } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, productName, updates } = body;

    if (!productId || !updates) {
      return NextResponse.json({ error: "Product ID and updates required" }, { status: 400 });
    }

    // Log each change
    for (const [field, value] of Object.entries(updates)) {
      if (typeof value === "string" || Array.isArray(value)) {
        addOptimizationHistory(productId, productName || "", field, "", String(value));
      }
    }

    const result = await updateProduct(productId, updates);
    return NextResponse.json({ success: true, product: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}
