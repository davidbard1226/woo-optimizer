import { NextRequest, NextResponse } from "next/server";
import { fetchProduct, updateProduct } from "@/lib/woocommerce";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, action, imageId, imageUrl, imageName, imageUrls, position } = body;

    if (!productId) {
      return NextResponse.json({ error: "productId required" }, { status: 400 });
    }

    const product = await fetchProduct(productId);
    let images = (product.images || []).map((img) => ({
      id: img.id,
      src: img.src,
      name: img.name || "",
      alt: img.alt || "",
      position: img.position ?? 0,
    }));

    switch (action) {
      case "add": {
        if (!imageUrl) {
          return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
        }
        const newImage = {
          id: -Date.now(),
          src: imageUrl,
          name: imageName || "",
          alt: "",
          position: images.length,
        };
        images.push(newImage);
        break;
      }
      case "remove": {
        if (!imageId) {
          return NextResponse.json({ error: "imageId required" }, { status: 400 });
        }
        images = images.filter((img) => img.id !== imageId);
        // Re-index positions
        images.forEach((img, i) => { img.position = i; });
        break;
      }
      case "bulk-add": {
        if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
          return NextResponse.json({ error: "imageUrls array required" }, { status: 400 });
        }
        for (const url of imageUrls) {
          if (typeof url !== "string") continue;
          images.push({
            id: -Date.now() - Math.floor(Math.random() * 10000),
            src: url,
            name: "",
            alt: "",
            position: images.length,
          });
        }
        break;
      }
      case "reorder": {
        if (typeof position !== "number" || !imageId) {
          return NextResponse.json({ error: "imageId and position required" }, { status: 400 });
        }
        const idx = images.findIndex((img) => img.id === imageId);
        if (idx === -1) {
          return NextResponse.json({ error: "Image not found" }, { status: 404 });
        }
        const [moved] = images.splice(idx, 1);
        images.splice(position, 0, moved);
        images.forEach((img, i) => { img.position = i; });
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const result = await updateProduct(productId, { images } as any);
    return NextResponse.json({ success: true, images: result.images });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image update failed" },
      { status: 500 }
    );
  }
}
