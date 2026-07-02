import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const wcUrl = getSetting("wc_url") || process.env.WC_URL || "";
    const consumerKey = getSetting("wc_consumer_key") || process.env.WC_CONSUMER_KEY || "";
    const consumerSecret = getSetting("wc_consumer_secret") || process.env.WC_CONSUMER_SECRET || "";

    if (!wcUrl || !consumerKey || !consumerSecret) {
      return NextResponse.json({ error: "WooCommerce not configured" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wpForm = new FormData();
    const blob = new Blob([buffer], { type: file.type });
    wpForm.append("file", blob, file.name);

    const auth = `consumer_key=${consumerKey}&consumer_secret=${consumerSecret}`;
    const wpUrl = `${wcUrl.replace(/\/+$/, "")}/wp-json/wp/v2/media?${auth}`;

    const wpRes = await fetch(wpUrl, {
      method: "POST",
      body: wpForm,
    });

    if (!wpRes.ok) {
      const text = await wpRes.text();
      throw new Error(`WordPress media upload failed (${wpRes.status}): ${text}`);
    }

    const media = await wpRes.json();
    const imageUrl = media.source_url || media.url;

    return NextResponse.json({ success: true, url: imageUrl, id: media.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}


