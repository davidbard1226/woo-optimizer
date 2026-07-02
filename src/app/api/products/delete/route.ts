import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productIds } = body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: "productIds array required" }, { status: 400 });
    }

    const wcUrl = (getSetting("wc_url") || process.env.WC_URL || "").replace(/\/+$/, "");
    const consumerKey = getSetting("wc_consumer_key") || process.env.WC_CONSUMER_KEY || "";
    const consumerSecret = getSetting("wc_consumer_secret") || process.env.WC_CONSUMER_SECRET || "";
    const auth = `consumer_key=${consumerKey}&consumer_secret=${consumerSecret}`;

    const results: { id: number; deleted: boolean; error?: string }[] = [];

    for (const id of productIds) {
      try {
        const res = await fetch(`${wcUrl}/wp-json/wc/v3/products/${id}?${auth}&force=true`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const text = await res.text();
          results.push({ id, deleted: false, error: `HTTP ${res.status}: ${text.slice(0, 100)}` });
        } else {
          results.push({ id, deleted: true });
        }
      } catch (err) {
        results.push({ id, deleted: false, error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    const deleted = results.filter((r) => r.deleted).length;
    const failed = results.filter((r) => !r.deleted).length;

    return NextResponse.json({ deleted, failed, results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 }
    );
  }
}
