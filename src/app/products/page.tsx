"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { WCProduct, HealthScore as HealthScoreType } from "@/lib/types";
import { calculateHealthScore } from "@/lib/health-score";
import HealthScoreComponent from "@/components/HealthScore";
import { Search, ChevronLeft, ChevronRight, ExternalLink, Loader2, AlertCircle } from "lucide-react";

interface ProductWithScore extends WCProduct {
  healthScore: HealthScoreType;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [error, setError] = useState("");
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

  const loadProducts = useCallback(async (searchTerm: string, pageNum: number) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        per_page: "20",
        orderby: sortBy,
        order: sortOrder,
        status: "any",
      });
      if (searchTerm) params.set("search", searchTerm);

      const res = await fetch(`/api/products?${params}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load products");
      }
      const data = await res.json();

      const withScores: ProductWithScore[] = (data.products || []).map((p: WCProduct) => ({
        ...p,
        healthScore: calculateHealthScore(p),
      }));

      if (sortBy === "health") {
        withScores.sort((a, b) =>
          sortOrder === "asc"
            ? a.healthScore.total - b.healthScore.total
            : b.healthScore.total - a.healthScore.total
        );
      }

      setProducts(withScores);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortOrder]);

  useEffect(() => {
    loadProducts(search, page);
  }, [page, sortBy, sortOrder, search, loadProducts]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 400);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-gray-400">{total.toLocaleString()} products total</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by product name, SKU..."
              className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Search
          </button>
        </form>

        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white"
        >
          <option value="date">Date</option>
          <option value="title">Title</option>
          <option value="price">Price</option>
          <option value="health">Health Score</option>
        </select>

        <button
          onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white hover:bg-gray-700"
        >
          {sortOrder === "asc" ? "↑ Asc" : "↓ Desc"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-800 bg-red-900/20 p-4 text-sm text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-12 text-center">
          <Search className="mx-auto mb-3 h-8 w-8 text-gray-600" />
          <p className="text-gray-400">
            {search ? `No products matching "${search}"` : "No products found"}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Try a different search term or clear the search box
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 text-left text-xs uppercase text-gray-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0].src}
                          alt={product.images[0].alt}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-800 text-gray-500">
                          No img
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-white">{product.name}</p>
                        <p className="text-xs text-gray-500">SKU: {product.sku || "N/A"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    R{product.price || product.regular_price || "0.00"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        product.status === "publish"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <HealthScoreComponent score={product.healthScore} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/products/${product.id}`}
                        className="rounded bg-blue-600/20 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-600/30"
                      >
                        Optimize
                      </Link>
                      <a
                        href={`${product.permalink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
