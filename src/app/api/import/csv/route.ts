import { NextRequest, NextResponse } from "next/server";
import { createProduct } from "@/lib/woocommerce";

interface CsvRow {
  sku: string;
  name: string;
  description: string;
  shortDescription: string;
  regularPrice: string;
  categories: string;
  images: string[];
  inStock: boolean;
  brand: string;
}

function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines: string[] = [];
  let cur = "", inQ = false;
  for (const ch of text) {
    if (ch === '"') inQ = !inQ;
    cur += ch;
    if (ch === "\n" && !inQ) {
      if (cur.trim()) lines.push(cur.trimEnd());
      cur = "";
    }
  }
  if (cur.trim()) lines.push(cur.trim());

  const header = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine).filter((r) => r.length >= header.length);
  return { header, rows };
}

function parseLine(line: string): string[] {
  const parts: string[] = [];
  let cur = "", inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === "," && !inQ) { parts.push(cur); cur = ""; }
    else cur += ch;
  }
  parts.push(cur);
  return parts;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const text = await file.text();
    const { header, rows } = parseCsv(text);

    // Map header columns
    const colMap: Record<string, number> = {};
    for (let i = 0; i < header.length; i++) {
      const h = header[i].trim().toLowerCase();
      colMap[h] = i;
    }

    const skuIdx = colMap["sku"];
    const nameIdx = colMap["name"];
    const descIdx = colMap["description"];
    const shortDescIdx = colMap["short description"];
    const priceIdx = colMap["regular price"];
    const catIdx = colMap["categories"];
    const imgIdx = colMap["images"];
    const stockIdx = colMap["in stock?"];
    const brandIdx = colMap["brand"];

    const batchSize = 10;
    let offset = parseInt(formData.get("offset") as string) || 0;
    const update = formData.get("update") === "true";

    const batch = rows.slice(offset, offset + batchSize);
    const results: Array<{
      sku: string;
      name: string;
      status: "created" | "skipped" | "error";
      productId?: number;
      error?: string;
    }> = [];

    for (const row of batch) {
      const sku = row[skuIdx]?.trim() || "";
      const name = row[nameIdx]?.trim() || "";
      if (!sku) {
        results.push({ sku: "", name, status: "error", error: "No SKU" });
        continue;
      }

      const description = descIdx !== undefined ? row[descIdx] || "" : "";
      const shortDescription = shortDescIdx !== undefined ? row[shortDescIdx] || "" : "";
      const price = priceIdx !== undefined ? row[priceIdx]?.trim() || "" : "";
      const categories = catIdx !== undefined ? row[catIdx]?.trim() || "" : "";
      const imagesField = imgIdx !== undefined ? row[imgIdx]?.trim() || "" : "";
      const inStock = stockIdx !== undefined ? row[stockIdx]?.trim() === "1" : true;
      const brand = brandIdx !== undefined ? row[brandIdx]?.trim() || "" : "";

      const imageUrls = imagesField
        .split(",")
        .map((u) => u.trim())
        .filter((u) => u.startsWith("http"));

      const catNames = categories
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      const productData: Record<string, unknown> = {
        name,
        type: "simple",
        sku,
        regular_price: price,
        description,
        short_description: shortDescription,
        stock_status: inStock ? "instock" : "outofstock",
        images: imageUrls.map((src) => ({ src })),
        categories: catNames.map((name) => ({ name })),
        meta_data: brand ? [{ key: "_brand", value: brand }] : [],
        status: "publish",
      };

      try {
        const created = await createProduct(productData);
        results.push({ sku, name, status: "created", productId: created.id });
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 200) : "Unknown error";
        results.push({ sku, name, status: "error", error: msg });
      }
    }

    offset += batch.length;
    const remaining = rows.length - offset;

    return NextResponse.json({
      processed: offset,
      total: rows.length,
      offset,
      remaining: Math.max(0, remaining),
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}
