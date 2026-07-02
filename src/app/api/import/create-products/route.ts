import { NextRequest, NextResponse } from "next/server";
import { fetchProductBySku, createProduct } from "@/lib/woocommerce";
import fs from "fs";
import path from "path";

interface ProductData {
  name: string;
  description: string;
  shortDescription: string;
  regularPrice: number;
  categories: string;
  images: string[];
  stockStatus: string;
}

interface CreateResult {
  sku: string;
  status: "created" | "exists" | "error" | "skipped";
  productId?: number;
  productName?: string;
  error?: string;
}

function dataPath(...parts: string[]): string {
  return path.join(process.cwd(), "data", ...parts);
}

function loadMapping(): Record<string, ProductData> | null {
  const p = dataPath("sandisk-products.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function loadProgress(): Record<string, "created" | "exists" | "error"> {
  const p = dataPath("import-products-progress.json");
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return {}; }
}

function saveProgress(progress: Record<string, "created" | "exists" | "error">) {
  const p = dataPath("import-products-progress.json");
  fs.writeFileSync(p, JSON.stringify(progress));
}

export async function GET() {
  const mapping = loadMapping();
  if (!mapping) {
    return NextResponse.json({ error: "Product mapping not found." }, { status: 404 });
  }

  const progress = loadProgress();
  const total = Object.keys(mapping).length;
  const completed = Object.keys(progress).length;

  return NextResponse.json({
    totalProducts: total,
    completed,
    remaining: total - completed,
  });
}

export async function POST(request: NextRequest) {
  try {
    const mapping = loadMapping();
    if (!mapping) {
      return NextResponse.json({ error: "Product mapping not found." }, { status: 404 });
    }

    const body = await request.json();
    const { batchSize = 20, offset = 0, skus: specificSkus, resume } = body;

    let skus = specificSkus || Object.keys(mapping);

    if (resume) {
      const progress = loadProgress();
      skus = skus.filter((s: string) => !(s in progress));
    }

    if (skus.length === 0) {
      return NextResponse.json({ processed: 0, total: 0, offset: 0, remaining: 0, results: [] });
    }

    const batch = skus.slice(offset, offset + batchSize);
    const results: CreateResult[] = [];
    const progress = loadProgress();

    for (const sku of batch) {
      const productData = mapping[sku];
      if (!productData) {
        progress[sku] = "error";
        results.push({ sku, status: "error", error: "No data in mapping" });
        continue;
      }

      try {
        const existing = await fetchProductBySku(sku);
        if (existing) {
          progress[sku] = "exists";
          results.push({ sku, status: "exists", productId: existing.id, productName: existing.name });
          continue;
        }

        const images = productData.images.map((src) => ({ src }));

        const newProduct = await createProduct({
          name: productData.name,
          type: "simple",
          sku,
          regular_price: String(productData.regularPrice),
          description: productData.description,
          short_description: productData.shortDescription,
          stock_status: productData.stockStatus,
          categories: productData.categories.split(",").map((c) => ({ name: c.trim() })),
          images,
          status: "publish",
        });

        progress[sku] = "created";
        results.push({ sku, status: "created", productId: newProduct.id, productName: newProduct.name });
      } catch (err) {
        progress[sku] = "error";
        results.push({ sku, status: "error", error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    saveProgress(progress);

    return NextResponse.json({
      processed: batch.length,
      total: skus.length,
      offset: offset + batch.length,
      remaining: skus.length - (offset + batch.length),
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}
