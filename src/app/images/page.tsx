"use client";

import { useState } from "react";
import { Image, Loader2, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";

interface ImageIssue {
  imageId: number;
  imageSrc: string;
  type: string;
  severity: string;
  message: string;
}

interface AuditResult {
  productId: number;
  productName: string;
  issues: ImageIssue[];
}

export default function ImagesPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AuditResult[]>([]);
  const [summary, setSummary] = useState<{ totalProducts: number; productsWithIssues: number; totalIssues: number } | null>(null);

  const runAudit = async () => {
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch("/api/images/audit?per_page=50");
      if (!res.ok) throw new Error("Audit failed");
      const data = await res.json();
      setResults(data.results || []);
      setSummary(data.summary || null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  };

  const autoFixAltText = async (productId: number, images: ImageIssue[]) => {
    try {
      const imageUpdates = images
        .filter((i) => i.type === "empty_alt" || i.type === "missing_alt")
        .map((i) => ({
          id: i.imageId,
          alt: "", // WooCommerce will use image name as fallback
        }));

      const res = await fetch("/api/images/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, imageUpdates }),
      });

      if (!res.ok) throw new Error("Fix failed");
      toast.success("Alt text fixed!");
      runAudit();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fix failed");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Image Audit</h1>
        <p className="text-gray-400">Check and fix product images</p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Run Image Audit</h2>
        <p className="mb-4 text-sm text-gray-400">
          Scans your products for image issues: missing alt text, broken URLs, and products with no images.
        </p>
        <button
          onClick={runAudit}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />}
          {loading ? "Scanning..." : "Run Audit"}
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <p className="text-sm text-gray-400">Products Scanned</p>
            <p className="text-2xl font-bold text-white">{summary.totalProducts}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <p className="text-sm text-gray-400">Products with Issues</p>
            <p className="text-2xl font-bold text-orange-400">{summary.productsWithIssues}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <p className="text-sm text-gray-400">Total Issues</p>
            <p className="text-2xl font-bold text-red-400">{summary.totalIssues}</p>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {results
            .filter((r) => r.issues.length > 0)
            .map((result) => (
              <div key={result.productId} className="rounded-xl border border-gray-800 bg-gray-900 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-medium text-white">{result.productName}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">ID: {result.productId}</span>
                    {result.issues.some((i) => i.type === "empty_alt" || i.type === "missing_alt") && (
                      <button
                        onClick={() => autoFixAltText(result.productId, result.issues)}
                        className="rounded bg-blue-600/20 px-2 py-1 text-xs text-blue-400 hover:bg-blue-600/30"
                      >
                        Fix Alt Text
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {result.issues.map((issue, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                        issue.severity === "critical"
                          ? "bg-red-500/10 text-red-400"
                          : issue.severity === "warning"
                          ? "bg-yellow-500/10 text-yellow-400"
                          : "bg-blue-500/10 text-blue-400"
                      }`}
                    >
                      {issue.severity === "critical" ? (
                        <XCircle className="h-4 w-4 shrink-0" />
                      ) : issue.severity === "warning" ? (
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                      ) : (
                        <CheckCircle className="h-4 w-4 shrink-0" />
                      )}
                      {issue.message}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {results.length > 0 && results.filter((r) => r.issues.length === 0).length > 0 && (
        <div className="rounded-xl border border-green-800 bg-green-900/20 p-4">
          <p className="text-sm text-green-400">
            {results.filter((r) => r.issues.length === 0).length} products have no image issues
          </p>
        </div>
      )}
    </div>
  );
}
