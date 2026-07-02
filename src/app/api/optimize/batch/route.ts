import { NextRequest, NextResponse } from "next/server";
import { fetchProducts, fetchProduct } from "@/lib/woocommerce";
import { generateAll } from "@/lib/ai";
import { saveBulkResult } from "@/lib/db";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("429") || msg.includes("rate-limited") || msg.includes("Resource Limit");
}

interface BatchResult {
  id: number;
  name: string;
  status: "success" | "error";
  error?: string;
}

async function processConcurrent(
  ids: number[],
  concurrency: number,
  processFn: (id: number) => Promise<{ name: string }>
): Promise<BatchResult[]> {
  const results: BatchResult[] = new Array(ids.length);
  let backoffMs = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < ids.length) {
      const idx = cursor++;
      const id = ids[idx];

      if (backoffMs > 0) await delay(backoffMs);

      try {
        const { name } = await processFn(id);
        results[idx] = { id, name, status: "success" };
        backoffMs = Math.max(0, backoffMs - 500); // ease off after a success
      } catch (err) {
        if (isRateLimitError(err)) {
          // back off exponentially (capped at 30s) and retry this same product
          backoffMs = Math.min(backoffMs ? backoffMs * 2 : 2000, 30000);
          cursor--;
          await delay(backoffMs);
        } else {
          results[idx] = {
            id,
            name: `Product ${id}`,
            status: "error",
            error: err instanceof Error ? err.message : "Unknown error",
          };
        }
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productIds, filters, maxProducts: requestedMax } = body;

    let ids = productIds as number[] | undefined;

    if (!ids || ids.length === 0) {
      const limit = Math.min(requestedMax || 10, 50);
      const result = await fetchProducts({
        per_page: limit,
        status: "publish",
        ...filters,
      });
      ids = result.products.map((p) => p.id);
    }

    const maxProducts = Math.min(ids.length, requestedMax || 10);
    const idsToProcess = ids.slice(0, maxProducts);

    const results = await processConcurrent(idsToProcess, 3, async (id) => {
      const product = await fetchProduct(id);
      const content = await generateAll(product);
      // Persist generated content so it can be reviewed/applied from the Bulk page
      // instead of being thrown away once the batch finishes.
      saveBulkResult(id, product.name, content);
      return { name: product.name };
    });

    return NextResponse.json({
      results,
      total: idsToProcess.length,
      processed: results.filter((r) => r.status === "success").length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Batch optimization failed" },
      { status: 500 }
    );
  }
}
