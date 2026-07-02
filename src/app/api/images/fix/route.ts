import { NextRequest, NextResponse } from "next/server";
import { fetchProduct, updateProduct } from "@/lib/woocommerce";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, imageUpdates } = body;

    if (!productId || !imageUpdates) {
      return NextResponse.json({ error: "Product ID and image updates required" }, { status: 400 });
    }

    const product = await fetchProduct(productId);

    const updatedImages = product.images.map((img) => {
      const update = imageUpdates.find((u: { id: number; alt?: string }) => u.id === img.id);
      if (update) {
        return { ...img, alt: update.alt ?? img.alt };
      }
      return img;
    });

    const result = await updateProduct(productId, { images: updatedImages } as Record<string, unknown>);

    return NextResponse.json({ success: true, product: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fix images" },
      { status: 500 }
    );
  }
}
