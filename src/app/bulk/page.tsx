"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, Loader2, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

interface BatchResult {
  id: number;
  name: string;
  status: "success" | "error";
  error?: string;
}

interface BulkResultEntry {
  productId: number;
  productName: string;
  content: {
    name?: string;
    description: string;
    shortDescription: string;
    metaTitle: string;
    metaDescription: string;
    tags?: string[];
    modelUsed?: string;
  };
  generatedAt: string;
}

export default function BulkPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [maxProducts, setMaxProducts] = useState(10);
  const [confirming, setConfirming] = useState(false);
  const [pendingReview, setPendingReview] = useState<BulkResultEntry[]>([]);
  const [applyingId, setApplyingId] = useState<number | null>(null);

  useEffect(() => {
    loadPendingReview();
  }, []);

  async function loadPendingReview() {
    try {
      const res = await fetch("/api/optimize/bulk-results");
      const data = await res.json();
      setPendingReview(data.results || []);
    } catch {
      // non-critical
    }
  }

  async function handleApplyOne(entry: BulkResultEntry) {
    setApplyingId(entry.productId);
    try {
      const res = await fetch("/api/optimize/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: entry.productId,
          productName: entry.productName,
          content: entry.content,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Apply failed");
      await fetch(`/api/optimize/bulk-results?productId=${entry.productId}`, { method: "DELETE" });
      toast.success(`Applied changes to ${entry.productName}`);
      await loadPendingReview();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setApplyingId(null);
    }
  }

  async function handleDiscardOne(productId: number) {
    await fetch(`/api/optimize/bulk-results?productId=${productId}`, { method: "DELETE" });
    await loadPendingReview();
  }

  const handleBulkOptimize = async () => {
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch("/api/optimize/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: {}, maxProducts }),
      });
      if (!res.ok) throw new Error("Batch optimization failed");
      const data = await res.json();
      setResults(data.results || []);
      toast.success(`Processed ${data.processed} products — review them below before applying`);
      await loadPendingReview();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch failed");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Bulk Optimize</h1>
        <p className="text-gray-400">Optimize multiple products at once with AI</p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Bulk AI Optimization</h2>
        <p className="mb-4 text-sm text-gray-400">
          This will fetch published products and generate AI-optimized content for each.
          The AI content will be generated but you should review it before applying to your live store.
        </p>

        <div className="mb-4 flex items-center gap-4">
          <label className="text-sm text-gray-400">Max products to process:</label>
          <input
            type="number"
            value={maxProducts}
            onChange={(e) => setMaxProducts(parseInt(e.target.value) || 10)}
            min={1}
            max={50}
            className="w-20 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
          />
        </div>

        <button
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              return;
            }
            setConfirming(false);
            handleBulkOptimize();
          }}
          disabled={loading}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${
            confirming ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {loading
            ? "Processing..."
            : confirming
            ? `Confirm: Optimize ${maxProducts} products?`
            : "Start Bulk Optimization"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <div className="mb-4 flex items-center gap-6">
            <h2 className="text-lg font-semibold text-white">Results</h2>
            <span className="text-sm text-green-400">{successCount} succeeded</span>
            {errorCount > 0 && <span className="text-sm text-red-400">{errorCount} failed</span>}
          </div>

          <div className="max-h-96 space-y-2 overflow-y-auto">
            {results.map((result) => (
              <div
                key={result.id}
                className="flex items-center justify-between rounded-lg bg-gray-800/50 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {result.status === "success" ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <div>
                    <p className="text-sm text-white">{result.name}</p>
                    {result.error && <p className="text-xs text-red-400">{result.error}</p>}
                  </div>
                </div>
                <span className="text-xs text-gray-500">ID: {result.id}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingReview.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">Awaiting Review ({pendingReview.length})</h2>
          <p className="mb-4 text-sm text-gray-400">
            Generated content is held here until you apply or discard it — nothing goes live automatically.
          </p>
          <div className="space-y-3">
            {pendingReview.map((entry) => (
              <div key={entry.productId} className="rounded-lg border border-gray-800 bg-gray-800/40 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{entry.content.name || entry.productName}</p>
                    <p className="text-xs text-gray-500">
                      ID: {entry.productId}
                      {entry.content.modelUsed && ` · ${entry.content.modelUsed}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/products/${entry.productId}`}
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      View <ExternalLink className="h-3 w-3" />
                    </Link>
                    <button
                      onClick={() => handleDiscardOne(entry.productId)}
                      className="text-xs text-gray-500 hover:text-gray-400"
                    >
                      Discard
                    </button>
                    <button
                      onClick={() => handleApplyOne(entry)}
                      disabled={applyingId === entry.productId}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {applyingId === entry.productId ? "Applying..." : "Apply to WooCommerce"}
                    </button>
                  </div>
                </div>
                <p className="line-clamp-2 text-xs text-gray-400">{entry.content.shortDescription}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
