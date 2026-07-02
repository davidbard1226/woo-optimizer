import { NextRequest, NextResponse } from "next/server";
import { fetchProducts, updateProduct, fetchProduct } from "@/lib/woocommerce";
import { WCProduct } from "@/lib/types";

interface BatchResult {
  productId: number;
  name: string;
  altFilled: number;
  categoryAdded: string | null;
  attributesAdded: number;
  error?: string;
}

function extractAttributes(product: WCProduct): { name: string; options: string[]; visible: boolean; variation: boolean }[] {
  const existing = new Set((product.attributes || []).map((a) => a.name.toLowerCase()));
  const text = (product.name + " " + (product.description || "") + " " + (product.short_description || "")).toLowerCase();
  const attrDefs: { name: string; patterns: RegExp[] }[] = [
    { name: "Capacity", patterns: [/(\d+)\s*(gb|tb)/gi] },
    { name: "Interface", patterns: [/usb\s*3\.\d+/gi, /usb\s*2\.\d+/gi, /pcie\s*\d\.\d/gi, /nvme/gi, /sata/gi, /usb-c/gi, /thunderbolt/gi] },
    { name: "Speed", patterns: [/(\d+)\s*(mb\/s|gb\/s|mbps|gbps)/gi, /class\s*\d+/gi, /uhs[- ]\w+/gi, /(\d+)\s*ppm/gi] },
    { name: "Form Factor", patterns: [/m\.2/gi, /2\.5\s*inch/gi, /sff/gi, /desktop/gi, /laptop/gi, /portable/gi, /external/gi, /internal/gi] },
    { name: "Color", patterns: [/black/gi, /white/gi, /silver/gi, /grey/gi, /blue/gi, /red/gi, /gold/gi] },
    { name: "Type", patterns: [/sdhc/gi, /sdxc/gi, /microsd/gi, /cfexpress/gi, /compactflash/gi, /ssd/gi, /hdd/gi, /nvme/gi, /flash\s*drive/gi, /usb\s*drive/gi] },
    { name: "Compatibility", patterns: [/for\s+(\w+\s*\w*)/gi, /compatible\s+with\s+(.+)/gi] },
  ];

  const attrs: { name: string; options: string[]; visible: boolean; variation: boolean }[] = [];
  for (const def of attrDefs) {
    if (existing.has(def.name.toLowerCase())) continue;
    const options: string[] = [];
    for (const pattern of def.patterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        const val = match[1] ? match[1].trim() : match[0].trim();
        if (val.length > 1 && val.length < 30) options.push(val.charAt(0).toUpperCase() + val.slice(1).toLowerCase());
      }
    }
    const unique = Array.from(new Set(options)).slice(0, 3);
    if (unique.length > 0) {
      attrs.push({ name: def.name, options: unique, visible: true, variation: false });
    }
  }
  return attrs;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { batchSize = 50, offset = 0, fixAlts = true, fixCategories = true, fixAttributes = true } = body;

    const { products, total } = await fetchProducts({ per_page: batchSize, page: Math.floor(offset / batchSize) + 1, status: "any" });

    if (products.length === 0) {
      return NextResponse.json({ processed: 0, total: 0, offset: 0, remaining: 0 });
    }

    const results: BatchResult[] = [];

    for (const product of products) {
      try {
        const full = await fetchProduct(product.id);
        const updates: Record<string, unknown> = {};
        let altFilled = 0;
        let categoryAdded: string | null = null;
        let attributesAdded = 0;

        // 1. Fill alt text on images
        if (fixAlts && full.images) {
          const updatedImages = full.images.map((img) => {
            if (!img.alt || img.alt.trim().length === 0) {
              altFilled++;
              return { ...img, alt: full.name || "" };
            }
            return img;
          });
          if (altFilled > 0) updates.images = updatedImages;
        }

        // 2. Add second category if only 1
        if (fixCategories && full.categories && full.categories.length === 1) {
          const cats = full.categories.map((c) => c.name);
          const parentName = cats[0];
          const subCats: Record<string, string> = {
            "Memory Cards & Storage": "Storage Devices",
            "Storage": "Memory Cards",
            "Printers & Scanners": "Printer Accessories",
            "Laptops & Desktops": "Desktop Accessories",
            "Networking": "Network Accessories",
            "Cables & Adapters": "Connectivity",
            "Software": "Digital Products",
          };
          const second = subCats[parentName] || "Accessories";
          if (!cats.includes(second)) {
            full.categories.push({ id: 0, name: second, slug: "" });
            updates.categories = full.categories;
            categoryAdded = second;
          }
        }

        // 3. Extract attributes
        if (fixAttributes) {
          const existing = full.attributes || [];
          const newAttrs = extractAttributes(full).filter(
            (na) => !existing.some((ea) => ea.name.toLowerCase() === na.name.toLowerCase())
          );
          if (newAttrs.length > 0) {
            updates.attributes = [...existing, ...newAttrs];
            attributesAdded = newAttrs.length;
          }
        }

        // Apply updates
        if (Object.keys(updates).length > 0) {
          await updateProduct(full.id, updates as any);
        }

        results.push({
          productId: full.id,
          name: full.name || "",
          altFilled,
          categoryAdded,
          attributesAdded,
        });
      } catch (err) {
        results.push({
          productId: product.id,
          name: product.name || "",
          altFilled: 0,
          categoryAdded: null,
          attributesAdded: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const newOffset = offset + products.length;
    return NextResponse.json({
      processed: products.length,
      total,
      offset: newOffset,
      remaining: Math.max(0, total - newOffset),
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Batch optimize failed" },
      { status: 500 }
    );
  }
}
