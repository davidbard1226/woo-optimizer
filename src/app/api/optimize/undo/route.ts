import { NextRequest, NextResponse } from "next/server";
import { updateProduct } from "@/lib/woocommerce";
import { getHistoryEntry } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { historyId } = await request.json();
    if (!historyId) {
      return NextResponse.json({ error: "historyId required" }, { status: 400 });
    }

    const entry = getHistoryEntry(historyId);
    if (!entry) {
      return NextResponse.json({ error: "History entry not found (it may have expired)" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    switch (entry.field) {
      case "name":
        updateData.name = entry.old_value;
        break;
      case "description":
        updateData.description = entry.old_value;
        break;
      case "short_description":
        updateData.short_description = entry.old_value;
        break;
      case "meta_title":
        updateData.meta_data = [
          { key: "_yoast_wpseo_title", value: entry.old_value },
          { key: "rank_math_title", value: entry.old_value },
          { key: "_seo_title", value: entry.old_value },
        ];
        break;
      case "meta_description":
        updateData.meta_data = [
          { key: "_yoast_wpseo_metadesc", value: entry.old_value },
          { key: "rank_math_description", value: entry.old_value },
          { key: "_seo_description", value: entry.old_value },
        ];
        break;
      case "tags":
        updateData.tags = entry.old_value
          ? entry.old_value.split(",").map((t: string) => ({ name: t.trim() })).filter((t: { name: string }) => t.name)
          : [];
        break;
      default:
        return NextResponse.json({ error: `Cannot undo field: ${entry.field}` }, { status: 400 });
    }

    const result = await updateProduct(entry.product_id, updateData);

    return NextResponse.json({ success: true, restoredField: entry.field, product: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Undo failed" },
      { status: 500 }
    );
  }
}
