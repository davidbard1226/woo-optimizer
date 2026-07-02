import { NextRequest, NextResponse } from "next/server";
import { getAllSettings, setSetting } from "@/lib/db";
import { testConnection } from "@/lib/woocommerce";
import { testAIConnection } from "@/lib/ai";

export async function GET() {
  try {
    const settings = getAllSettings();
    // Merge env var overrides so Render-deployed instances work without file settings
    const merged = {
      wc_url: settings.wc_url || process.env.WC_URL || "",
      wc_consumer_key: settings.wc_consumer_key || process.env.WC_CONSUMER_KEY || "",
      wc_consumer_secret: settings.wc_consumer_secret || process.env.WC_CONSUMER_SECRET || "",
      openrouter_api_key: settings.openrouter_api_key || process.env.OPENROUTER_API_KEY || "",
      ai_model: settings.ai_model || process.env.AI_MODEL || "deepseek/deepseek-chat-v3-0324:free",
    };
    return NextResponse.json(merged);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string") {
        setSetting(key, value);
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { testType } = body;

    if (testType === "woocommerce") {
      const result = await testConnection();
      return NextResponse.json(result);
    }

    if (testType === "ai") {
      const result = await testAIConnection();
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown test type" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
