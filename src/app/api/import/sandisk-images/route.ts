import { NextRequest, NextResponse } from "next/server";
import { fetchProductBySku, updateProduct } from "@/lib/woocommerce";
import fs from "fs";
import path from "path";

interface ImportResult {
  sku: string;
  status: "matched" | "not_found" | "error" | "skipped";
  productId?: number;
  productName?: string;
  imagesAdded?: number;
  error?: string;
}

function dataPath(...parts: string[]): string {
  return path.join(process.cwd(), "data", ...parts);
}

function loadMapping(): Record<string, string[]> | null {
  const p = dataPath("sandisk-images.json");
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function loadProgress(): Record<string, "matched" | "not_found" | "error"> {
  const p = dataPath("import-images-progress.json");
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return {}; }
}

function saveProgress(progress: Record<string, "matched" | "not_found" | "error">) {
  const p = dataPath("import-images-progress.json");
  fs.writeFileSync(p, JSON.stringify(progress));
}

export async function GET() {
  const mapping = loadMapping();
  if (!mapping) {
    return NextResponse.json(
      { error: "Sandisk image mapping not found. Run preprocessing first." },
      { status: 404 }
    );
  }

  const skus = Object.keys(mapping);
  const totalImages = Object.values(mapping).reduce((sum, urls) => sum + urls.length, 0);
  const alphaSkus = skus.filter((s) => !/^\d+$/.test(s)).length;
  const progress = loadProgress();
  const completed = Object.keys(progress).length;

  return NextResponse.json({
    totalSkus: skus.length,
    properSkus: alphaSkus,
    totalImages,
    avgImagesPerSku: (totalImages / skus.length).toFixed(1),
    completed,
    remaining: skus.length - completed,
  });
}

export async function POST(request: NextRequest) {
  try {
    const mapping = loadMapping();
    if (!mapping) {
      return NextResponse.json(
        { error: "Sandisk image mapping not found. Run preprocessing first." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { batchSize = 50, offset = 0, skus: specificSkus, resume } = body;

    let skus = specificSkus || Object.keys(mapping);

    if (resume) {
      const progress = loadProgress();
      skus = skus.filter((s: string) => !(s in progress));
    }

    if (skus.length === 0) {
      return NextResponse.json({ processed: 0, total: 0, offset: 0, remaining: 0, results: [] });
    }

    const batch = skus.slice(offset, offset + batchSize);
    const results: ImportResult[] = [];
    const progress = loadProgress();

    for (const sku of batch) {
      const imageUrls = mapping[sku];
      if (!imageUrls || imageUrls.length === 0) {
        progress[sku] = "error";
        results.push({ sku, status: "error", error: "No images in mapping" });
        continue;
      }

      try {
        const product = await fetchProductBySku(sku);
        if (!product) {
          progress[sku] = "not_found";
          results.push({ sku, status: "not_found" });
          continue;
        }

        const images = imageUrls.map((src, i) => ({
          id: i,
          src,
          name: "",
          alt: product.name || "",
          position: i,
        }));

        await updateProduct(product.id, { images } as any);

        progress[sku] = "matched";
        results.push({ sku, status: "matched", productId: product.id, productName: product.name, imagesAdded: images.length });
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
