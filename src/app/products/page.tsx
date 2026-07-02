"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { WCProduct, HealthScore as HealthScoreType } from "@/lib/types";
import { calculateHealthScore } from "@/lib/health-score";
import HealthScoreComponent from "@/components/HealthScore";
import { Search, ChevronLeft, ChevronRight, ExternalLink, Loader2, AlertCircle, Trash2, CheckSquare, Square } from "lucide-react";
import toast from "react-hot-toast";

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
  const [searchFallback, setSearchFallback] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
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
      setSelected(new Set());
      setSearchFallback(!!data.searchFallback);
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

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === products.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(products.map((p) => p.id)));
    }
  }

  async function handleDelete(productId?: number) {
    const ids = productId ? [productId] : Array.from(selected);
    if (ids.length === 0) { toast.error("No products selected"); return; }
    if (!confirm(`Delete ${ids.length} product(s)? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/products/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: ids }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Delete failed");
      }
      const data = await res.json();
      toast.success(`Deleted ${data.deleted} product(s)`);
      loadProducts(search, page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-gray-400">{total.toLocaleString()} products total</p>
        </div>
        <div className="flex items-center gap-3">
          {selected.size > 0 && (
            <>
              <span className="text-sm text-gray-400">{selected.size} selected</span>
              <button
                onClick={() => handleDelete()}
                disabled={deleting}
                className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting..." : "Delete Selected"}
              </button>
            </>
          )}
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
              placeholder="Search by product name, brand, SKU..."
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

      {searchFallback && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-800 bg-amber-900/20 p-4 text-sm text-amber-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          WooCommerce search API returned an error. Results are filtered client-side and may be incomplete.
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
                <th className="w-10 px-2 py-3">
                  <button onClick={toggleSelectAll} className="text-gray-500 hover:text-white">
                    {selected.size === products.length ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                </th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {products.map((product) => (
                <tr key={product.id} className={`hover:bg-gray-800/50 ${selected.has(product.id) ? "bg-blue-900/20" : ""}`}>
                  <td className="px-2 py-3">
                    <button onClick={() => toggleSelect(product.id)} className="text-gray-500 hover:text-white">
                      {selected.has(product.id) ? <CheckSquare className="h-4 w-4 text-blue-400" /> : <Square className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0].src}
                          alt={product.images[0].alt || product.name}
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-800 text-gray-500 text-[10px]">
                          No img
                        </div>
                      )}
                      <div>
                        <Link href={`/products/${product.id}`} className="font-medium text-white hover:text-blue-400">
                          {product.name}
                        </Link>
                        <p className="text-xs text-gray-500">SKU: {product.sku || "N/A"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    R{product.price || product.regular_price || "0.00"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      product.status === "publish" ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"
                    }`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <HealthScoreComponent score={calculateHealthScore(product)} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/products/${product.id}`}
                        className="rounded bg-blue-600/20 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-600/30"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="rounded bg-red-600/20 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-600/30"
                      >
                        Delete
                      </button>
                      <a
                        href={product.permalink}
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
