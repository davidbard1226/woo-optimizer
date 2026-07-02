"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  FileImage,
  PackagePlus,
} from "lucide-react";
import toast from "react-hot-toast";

interface MappingStats {
  totalSkus: number;
  properSkus: number;
  totalImages: number;
  avgImagesPerSku: string;
  completed: number;
  remaining: number;
}

interface ProductStats {
  totalProducts: number;
  completed: number;
  remaining: number;
}

type ResultStatus = "matched" | "not_found" | "error" | "created" | "exists";

interface ImportResult {
  sku: string;
  status: ResultStatus;
  productId?: number;
  productName?: string;
  imagesAdded?: number;
  error?: string;
}

interface ImportProgress {
  processed: number;
  total: number;
  offset: number;
  remaining: number;
  results: ImportResult[];
}

type Mode = "images" | "products";

export default function ImportPage() {
  const [mode, setMode] = useState<Mode>("images");
  const [stats, setStats] = useState<MappingStats | null>(null);
  const [productStats, setProductStats] = useState<ProductStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [batchSize, setBatchSize] = useState(20);
  const [skipCompleted, setSkipCompleted] = useState(true);
  const [nameMatch, setNameMatch] = useState(true);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    loadAllStats();
  }, []);

  async function loadAllStats() {
    try {
      const [imgRes, prodRes] = await Promise.all([
        fetch("/api/import/sandisk-images"),
        fetch("/api/import/create-products"),
      ]);
      if (imgRes.ok) setStats(await imgRes.json());
      if (prodRes.ok) setProductStats(await prodRes.json());
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }

  const handleImport = useCallback(async () => {
    setImporting(true);
    setResults([]);
    setProgress(null);
    cancelledRef.current = false;
    let currentOffset = 0;
    let allResults: ImportResult[] = [];
    const endpoint = mode === "images" ? "/api/import/sandisk-images" : "/api/import/create-products";

    while (!cancelledRef.current) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchSize, offset: currentOffset, resume: skipCompleted, nameMatch }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Import failed");
        }

        const data: ImportProgress = await res.json();
        setProgress(data);
        allResults = [...allResults, ...data.results];
        setResults(allResults);
        currentOffset = data.offset;

        if (data.remaining <= 0) break;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Import failed");
        break;
      }
    }

    setImporting(false);
    toast.success(mode === "images" ? "Image import complete!" : "Product creation complete!");
  }, [batchSize, mode, nameMatch]);

  function cancelImport() {
    cancelledRef.current = true;
    setImporting(false);
  }

  const matched = results.filter((r) => r.status === "matched" || r.status === "created");
  const notFound = results.filter((r) => r.status === "not_found" || r.status === "exists");
  const errors = results.filter((r) => r.status === "error");

  const displayResults = onlyIssues
    ? results.filter((r) => r.status !== "matched" && r.status !== "created")
    : results;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const totalToProcess = mode === "images"
    ? (stats?.totalSkus ?? 0)
    : (productStats?.totalProducts ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Import Products</h1>
        <p className="text-gray-400">
          Push scraped SanDisk data from FirstShop to your Bonolo Online store
        </p>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("images")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            mode === "images"
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          <FileImage className="h-4 w-4" />
          Import Images
        </button>
        <button
          onClick={() => setMode("products")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            mode === "products"
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          <PackagePlus className="h-4 w-4" />
          Create Missing Products
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {mode === "images" && stats ? (
          <>
            <StatCard icon={<FileImage className="h-5 w-5 text-blue-400" />} label="Products in Mapping" value={stats.totalSkus} bg="bg-blue-500/10" />
            <StatCard icon={<CheckCircle className="h-5 w-5 text-green-400" />} label="Proper SKUs" value={stats.properSkus} bg="bg-green-500/10" />
            <StatCard icon={<Download className="h-5 w-5 text-purple-400" />} label="Total Images" value={stats.totalImages} bg="bg-purple-500/10" />
            <StatCard icon={<FileImage className="h-5 w-5 text-orange-400" />} label="Avg Images/Product" value={stats.avgImagesPerSku} bg="bg-orange-500/10" />
          </>
        ) : mode === "products" && productStats ? (
          <>
            <StatCard icon={<PackagePlus className="h-5 w-5 text-blue-400" />} label="Products Ready" value={productStats.totalProducts} bg="bg-blue-500/10" />
            <StatCard icon={<CheckCircle className="h-5 w-5 text-green-400" />} label="With Descriptions" value={productStats.totalProducts} bg="bg-green-500/10" />
            <StatCard icon={<Download className="h-5 w-5 text-purple-400" />} label="With Images" value={productStats.totalProducts} bg="bg-purple-500/10" />
            <StatCard icon={<FileImage className="h-5 w-5 text-orange-400" />} label="With Prices" value={productStats.totalProducts} bg="bg-orange-500/10" />
          </>
        ) : (
          <div className="col-span-4 rounded-xl border border-red-800 bg-red-900/20 p-6 text-center">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-400" />
            <p className="text-red-400">Data mapping not found.</p>
            <p className="mt-1 text-sm text-gray-500">
              Run preprocessing scripts first.
            </p>
          </div>
        )}
      </div>

      {/* Mode Description */}
      {mode === "images" ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-2 text-lg font-semibold text-white">Import Images</h2>
          <p className="mb-4 text-sm text-gray-400">
            Matches products by SKU and pushes FirstShop images to your existing WooCommerce products.
            Products that already have images will be overwritten with the FirstShop images.
            When enabled, name-based fallback searches by product name for non-matching SKUs.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-800 bg-amber-900/20 p-6">
          <h2 className="mb-2 text-lg font-semibold text-amber-300">Create Missing Products</h2>
          <p className="mb-4 text-sm text-amber-400">
            Scans your WooCommerce store for each SanDisk SKU. If a product doesn't exist, it will be
            created with the scraped name, description, bullet points, price (with markup), images, and
            categories. This will skip any SKU that already exists in your store.
          </p>
          <p className="text-sm text-amber-400">
            <strong>{productStats?.totalProducts ?? 0}</strong> products are ready to be uploaded.
          </p>
        </div>
      )}

      {/* Import Controls */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Run</h2>

        <div className="mb-4 space-y-3">
          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-400">Batch size:</label>
            <input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value) || 20)}
              min={1}
              max={100}
              className="w-20 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
            />
            <span className="text-xs text-gray-500">
              Processed per request ({totalToProcess} total)
            </span>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={skipCompleted}
              onChange={(e) => setSkipCompleted(e.target.checked)}
              className="rounded border-gray-600 bg-gray-800"
            />
            Skip already processed — resume where I left off
            {mode === "images" && stats && stats.completed > 0 && (
              <span className="text-xs text-blue-400">({stats.completed} done, {stats.remaining} remaining)</span>
            )}
            {mode === "products" && productStats && productStats.completed > 0 && (
              <span className="text-xs text-blue-400">({productStats.completed} done, {productStats.remaining} remaining)</span>
            )}
          </label>
          {mode === "images" && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={nameMatch}
                onChange={(e) => setNameMatch(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800"
              />
              Fall back to name-based matching when SKU not found
            </label>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!importing ? (
            <button
              onClick={handleImport}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              {mode === "images" ? "Start Image Import" : "Start Creating Products"}
            </button>
          ) : (
            <button
              onClick={cancelImport}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
            >
              <XCircle className="h-4 w-4" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {progress && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Progress</h2>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-gray-400">
              {progress.processed} of {progress.total} processed
            </span>
            <span className="text-gray-500">{progress.remaining} remaining</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-gray-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${(progress.processed / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-white">Results</h2>
              <span className="text-sm text-green-400">
                {matched.length} {mode === "images" ? "matched" : "created"}
              </span>
              {notFound.length > 0 && (
                <span className="text-sm text-yellow-400">
                  {notFound.length} {mode === "images" ? "not found" : "already exist"}
                </span>
              )}
              {errors.length > 0 && (
                <span className="text-sm text-red-400">{errors.length} errors</span>
              )}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={onlyIssues}
                onChange={(e) => setOnlyIssues(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800"
              />
              Show only issues
            </label>
          </div>

          <div className="max-h-96 space-y-1 overflow-y-auto">
            {displayResults.map((r, i) => (
              <div
                key={`${r.sku}-${i}`}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-gray-800/50"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {r.status === "matched" || r.status === "created" ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-400" />
                  ) : r.status === "not_found" || r.status === "exists" ? (
                    <AlertCircle className="h-4 w-4 shrink-0 text-yellow-400" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                  )}
                  <span className="font-mono text-xs text-gray-400">{r.sku}</span>
                  {r.productName && (
                    <span className="truncate text-gray-300">{r.productName}</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {r.status === "matched" && r.imagesAdded && (
                    <span className="text-xs text-blue-400">{r.imagesAdded} images</span>
                  )}
                  {r.productId && <ChevronRight className="h-4 w-4 text-gray-600" />}
                  {r.error && (
                    <span className="max-w-[200px] truncate text-xs text-red-400" title={r.error}>
                      {r.error}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  bg: string;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className={`mb-3 inline-flex rounded-lg p-2 ${bg}`}>{icon}</div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}
