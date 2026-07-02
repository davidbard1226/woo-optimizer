import { NextRequest, NextResponse } from "next/server";
import { fetchProduct } from "@/lib/woocommerce";
import { generateAll, generateDescription, generateShortDescription, generateBulletPoints, generateSEO } from "@/lib/ai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, type } = body;

    if (!productId) {
      return NextResponse.json({ error: "Product ID required" }, { status: 400 });
    }

    const product = await fetchProduct(productId);

    let result;
    switch (type) {
      case "description":
        result = { description: await generateDescription(product) };
        break;
      case "short_description":
        result = { shortDescription: await generateShortDescription(product) };
        break;
      case "bullets":
        result = { bulletPoints: await generateBulletPoints(product) };
        break;
      case "seo":
        result = await generateSEO(product);
        break;
      case "all":
      default:
        result = await generateAll(product);
        break;
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI generation failed" },
      { status: 500 }
    );
  }
}
