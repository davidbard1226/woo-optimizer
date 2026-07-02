import { NextRequest, NextResponse } from "next/server";
import { updateProduct, fetchProduct } from "@/lib/woocommerce";
import { addOptimizationHistory } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, productName, content } = body;

    if (!productId || !content) {
      return NextResponse.json({ error: "Product ID and content required" }, { status: 400 });
    }

    // Fetch the current product first so we can record real "before" values for undo
    const current = await fetchProduct(productId);

    const metaData: Array<{ key: string; value: string }> = [];
    const updateData: Record<string, unknown> = {};

    const getMeta = (key: string) =>
      (current.meta_data as Array<{ key: string; value: string }> | undefined)?.find((m) => m.key === key)?.value || "";

    // Product title
    if (content.name) {
      updateData.name = content.name;
      addOptimizationHistory(productId, productName || "", "name", current.name || "", content.name);
    }

    // Long description
    if (content.description) {
      updateData.description = content.description;
      addOptimizationHistory(productId, productName || "", "description", current.description || "", content.description);
    }

    // Short description
    if (content.shortDescription) {
      updateData.short_description = content.shortDescription;
      addOptimizationHistory(productId, productName || "", "short_description", current.short_description || "", content.shortDescription);
    }

    // Meta title (SEO)
    if (content.metaTitle) {
      metaData.push(
        { key: "_yoast_wpseo_title", value: content.metaTitle },
        { key: "rank_math_title", value: content.metaTitle },
        { key: "_seo_title", value: content.metaTitle }
      );
      addOptimizationHistory(productId, productName || "", "meta_title", getMeta("_yoast_wpseo_title"), content.metaTitle);
    }

    // Meta description (SEO)
    if (content.metaDescription) {
      metaData.push(
        { key: "_yoast_wpseo_metadesc", value: content.metaDescription },
        { key: "rank_math_description", value: content.metaDescription },
        { key: "_seo_description", value: content.metaDescription }
      );
      addOptimizationHistory(productId, productName || "", "meta_description", getMeta("_yoast_wpseo_metadesc"), content.metaDescription);
    }

    // Focus keyword
    if (content.focusKeyword) {
      metaData.push(
        { key: "_yoast_wpseo_focuskw", value: content.focusKeyword },
        { key: "rank_math_focus_keyword", value: content.focusKeyword }
      );
    }

    // Attach meta data if any
    if (metaData.length > 0) {
      updateData.meta_data = metaData;
    }

    // Tags
    if (content.tags && Array.isArray(content.tags)) {
      updateData.tags = content.tags.map((tag: string) => ({ name: tag }));
      addOptimizationHistory(
        productId,
        productName || "",
        "tags",
        current.tags?.map((t) => t.name).join(", ") || "",
        content.tags.join(", ")
      );
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No content to apply" }, { status: 400 });
    }

    const result = await updateProduct(productId, updateData);

    return NextResponse.json({ success: true, product: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to apply content" },
      { status: 500 }
    );
  }
}
