"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { WCProduct, AIGeneratedContent, HealthScore as HealthScoreType } from "@/lib/types";
import { calculateHealthScore } from "@/lib/health-score";
import HealthScoreComponent from "@/components/HealthScore";
import { ArrowLeft, Loader2, ExternalLink, Check, Image as ImageIcon, Plus, Trash2, ArrowUp, ArrowDown, Upload, FileText } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

interface FieldOption {
  key: string;
  label: string;
  enabled: boolean;
}

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params?.id ? parseInt(params.id as string) : 0;

  const [product, setProduct] = useState<WCProduct | null>(null);
  const [healthScore, setHealthScore] = useState<HealthScoreType | null>(null);
  const [generated, setGenerated] = useState<AIGeneratedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selectedFields, setSelectedFields] = useState<FieldOption[]>([
    { key: "name", label: "Product Title", enabled: true },
    { key: "shortDescription", label: "Short Description + Bullets", enabled: true },
    { key: "description", label: "Full Description", enabled: true },
    { key: "seo", label: "SEO (Meta Title + Description)", enabled: true },
    { key: "tags", label: "Tags", enabled: true },
  ]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (productId) loadProduct();
  }, [productId]);

  async function loadProduct() {
    try {
      const res = await fetch(`/api/products/${productId}`);
      if (!res.ok) throw new Error("Failed to load product");
      const data = await res.json();
      setProduct(data);
      setHealthScore(calculateHealthScore(data));
    } catch {
      toast.error("Failed to load product");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, type: "all" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }
      const content = await res.json();
      setGenerated(content);
      toast.success("AI content generated! Review and select fields to apply.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleApplySelected() {
    if (!generated) return;
    setApplying(true);
    try {
      const filtered: Record<string, unknown> = {};
      for (const field of selectedFields) {
        if (!field.enabled) continue;
        switch (field.key) {
          case "name":
            if (generated.name) filtered.name = generated.name;
            break;
          case "shortDescription":
            filtered.short_description = generated.shortDescription;
            break;
          case "description":
            filtered.description = generated.description;
            break;
          case "seo":
            filtered.meta_title = generated.metaTitle;
            filtered.meta_description = generated.metaDescription;
            filtered.focus_keyword = generated.focusKeyword;
            break;
          case "tags":
            if (generated.tags) filtered.tags = generated.tags;
            break;
        }
      }

      const res = await fetch("/api/optimize/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, productName: product?.name, content: filtered }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Apply failed");
      }
      toast.success("Changes pushed to WooCommerce!");
      await loadProduct();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setApplying(false);
    }
  }

  function toggleField(key: string) {
    setSelectedFields((prev) => prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f)));
  }

  async function handleManualSave(updates: Record<string, unknown>) {
    const res = await fetch("/api/products/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, productName: product?.name, updates }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Update failed");
    }
    toast.success("Changes saved to WooCommerce!");
    await loadProduct();
  }

  async function handlePdfUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload/pdf", { method: "POST", body: fd });
      if (!res.ok) {
        const txt = await res.text();
        let msg = txt;
        try { const j = JSON.parse(txt); msg = j.error || msg; } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      await handleManualSave({ description: data.text });
      toast.success("PDF content applied as full description!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF upload failed");
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-12 text-center">
        <p className="text-gray-400">Product not found</p>
        <Link href="/products" className="mt-3 inline-block text-sm text-blue-400 hover:underline">Back to Products</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/products" className="rounded-lg p-2 hover:bg-gray-800">
          <ArrowLeft className="h-5 w-5 text-gray-400" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{product.name}</h1>
          <p className="text-gray-400">SKU: {product.sku || "N/A"} | ID: {product.id}</p>
        </div>
        {healthScore && <HealthScoreComponent score={healthScore} size="lg" />}
        <a href={product.permalink} target="_blank" rel="noopener noreferrer"
          className="rounded-lg border border-gray-700 bg-gray-800 p-2.5 text-gray-400 hover:text-white">
          <ExternalLink className="h-5 w-5" />
        </a>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">

          {/* Images Section (always visible) */}
          <ImageManager product={product} onRefresh={loadProduct} onInsertInDesc={(url) => {
            navigator.clipboard.writeText(`<img src="${url}" alt="" />`);
            toast.success("Image HTML copied to clipboard. Paste it into the description.");
          }} />

          {/* Current Content */}
          <div className="space-y-4">
            <ContentBlock title="Short Description" content={product.short_description} empty="No short description set" />
            <ContentBlock title="Full Description" content={product.description} empty="No description set" />

            {/* PDF Upload for Full Description */}
            <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-400">
                <FileText className="h-4 w-4" /> Upload PDF as Full Description
              </h3>
              <p className="mb-3 text-xs text-gray-500">
                Upload a product spec sheet PDF. The text will be extracted and set as the full description.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) { await handlePdfUpload(f); e.target.value = ""; }
                }}
                className="block w-full text-sm text-gray-400 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:bg-blue-700"
              />
            </div>
          </div>

          {/* AI Generator */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">AI Content Generator</h2>
              <button onClick={handleGenerate} disabled={generating}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {generating ? "Generating..." : "Generate AI Content"}
              </button>
            </div>

            {generated?.modelUsed && (
              <p className="text-xs text-gray-500">
                Generated using <span className="text-gray-400">{generated.modelUsed}</span>
              </p>
            )}

            {/* Field Selection + Apply */}
            {generated && (
              <div className="rounded-xl border border-green-800 bg-green-900/20 p-4">
                <h3 className="mb-3 text-sm font-semibold text-green-400">Select fields to push to WooCommerce:</h3>
                <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {selectedFields.map((field) => (
                    <label key={field.key} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${field.enabled ? "border-green-600 bg-green-600/10 text-green-400" : "border-gray-700 bg-gray-800 text-gray-500"}`}>
                      <input type="checkbox" checked={field.enabled} onChange={() => toggleField(field.key)} className="sr-only" />
                      <div className={`flex h-4 w-4 items-center justify-center rounded border ${field.enabled ? "border-green-500 bg-green-500" : "border-gray-600"}`}>
                        {field.enabled && <Check className="h-3 w-3 text-white" />}
                      </div>
                      {field.label}
                    </label>
                  ))}
                </div>
                <button onClick={handleApplySelected} disabled={applying}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                  {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {applying ? "Pushing to Store..." : "Apply Selected to WooCommerce"}
                </button>
              </div>
            )}

            {/* Generated Content Preview */}
            {generated && (
              <div className="space-y-4">
                {generated.name && (
                  <PreviewSection title="Product Title">
                    <p className="text-sm text-white font-medium">{generated.name}</p>
                  </PreviewSection>
                )}
                <PreviewSection title="Short Description + Bullet Points">
                  <div className="text-sm text-gray-300 whitespace-pre-line">{generated.shortDescription}</div>
                </PreviewSection>
                <PreviewSection title="Full Description">
                  <div className="prose prose-invert prose-sm max-w-none text-gray-400" dangerouslySetInnerHTML={{ __html: generated.description }} />
                </PreviewSection>
                <PreviewSection title="SEO Metadata">
                  <div className="space-y-1 text-sm">
                    <p><span className="text-gray-500">Title:</span> <span className="text-gray-300">{generated.metaTitle}</span></p>
                    <p><span className="text-gray-500">Description:</span> <span className="text-gray-300">{generated.metaDescription}</span></p>
                    <p><span className="text-gray-500">Keyword:</span> <span className="text-gray-300">{generated.focusKeyword}</span></p>
                  </div>
                </PreviewSection>
                {generated.tags && generated.tags.length > 0 && (
                  <PreviewSection title="Tags">
                    <div className="flex flex-wrap gap-2">{generated.tags.map((tag, i) => <span key={i} className="rounded-full bg-blue-500/20 px-3 py-1 text-xs text-blue-400">{tag}</span>)}</div>
                  </PreviewSection>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <HealthScoreCard healthScore={healthScore} />
          <ProductInfoCard product={product} onSave={handleManualSave} />
          <RecentChanges productId={productId} onUndo={loadProduct} />
        </div>
      </div>
    </div>
  );
}

function ContentBlock({ title, content, empty }: { title: string; content: string; empty: string }) {
  const clean = content?.replace(/<[^>]*>/g, "").trim();
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <h3 className="mb-2 text-sm font-semibold text-gray-300">{title}</h3>
      {clean ? <div className="prose prose-invert prose-sm max-w-none text-gray-400" dangerouslySetInnerHTML={{ __html: content }} /> : <p className="text-sm text-gray-500">{empty}</p>}
    </div>
  );
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
      <h4 className="mb-2 text-sm font-semibold text-gray-400">{title}</h4>
      {children}
    </div>
  );
}

function HealthScoreCard({ healthScore }: { healthScore: HealthScoreType | null }) {
  if (!healthScore) return null;
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-300">Health Score Breakdown</h3>
      <div className="space-y-2">
        {Object.entries(healthScore.breakdown).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-xs text-gray-400 capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-700">
                <div className={`h-full rounded-full ${value >= 80 ? "bg-green-500" : value >= 50 ? "bg-blue-500" : value >= 30 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${value}%` }} />
              </div>
              <span className="w-8 text-right text-xs text-gray-500">{value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductInfoCard({ product, onSave }: { product: WCProduct; onSave: (updates: Record<string, unknown>) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regularPrice, setRegularPrice] = useState(String(product.regular_price || product.price || ""));
  const [salePrice, setSalePrice] = useState(String(product.sale_price || ""));
  const [stockStatus, setStockStatus] = useState(product.stock_status || "instock");
  const [sku, setSku] = useState(product.sku || "");
  const [gtin, setGtin] = useState(String(product["gtin"] || ""));
  const [upc, setUpc] = useState(String(product["upc"] || ""));
  const [ean, setEan] = useState(String(product["ean"] || ""));
  const [tags, setTags] = useState(product.tags?.map((t) => t.name).join(", ") || "");

  async function handleSave() {
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {};
      const origPrice = product.regular_price || product.price || "";
      if (regularPrice !== origPrice) updates.regular_price = regularPrice;
      if (salePrice !== (product.sale_price || "")) updates.sale_price = salePrice || "";
      if (stockStatus !== product.stock_status) updates.stock_status = stockStatus;
      if (sku !== (product.sku || "")) updates.sku = sku;
      updates.meta_data = [
        { key: "gtin", value: gtin },
        { key: "upc", value: upc },
        { key: "ean", value: ean },
      ];
      if (tags !== (product.tags?.map((t) => t.name).join(", ") || "")) {
        updates.tags = tags.split(",").map((t) => t.trim()).filter(Boolean).map((name) => ({ name }));
      }
      await onSave(updates);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const viewMode = (
    <>
      <InfoRow label="Price" value={`R${product.price || product.regular_price || "0.00"}`} />
      {product.sale_price && <InfoRow label="Sale Price" value={`R${product.sale_price}`} />}
      <InfoRow label="Status" value={product.status} />
      <InfoRow label="Stock" value={product.stock_status} />
      <InfoRow label="SKU" value={product.sku || "N/A"} />
      {gtin && <InfoRow label="GTIN" value={gtin} />}
      {upc && <InfoRow label="UPC" value={upc} />}
      {ean && <InfoRow label="EAN" value={ean} />}
      <InfoRow label="Tags" value={tags || "None"} />
      <InfoRow label="Categories" value={product.categories?.map((c) => c.name).join(", ") || "None"} />
      <InfoRow label="Attributes" value={product.attributes?.map((a) => a.name).join(", ") || "None"} />
      <InfoRow label="Images" value={`${product.images?.length || 0} image(s)`} />
      <InfoRow label="Featured" value={product.featured ? "Yes" : "No"} />
    </>
  );

  const editMode = (
    <>
      <EditableRow label="Price (R)" value={regularPrice} onChange={setRegularPrice} type="number" />
      <EditableRow label="Sale Price (R)" value={salePrice} onChange={setSalePrice} type="number" />
      <SelectRow label="Stock" value={stockStatus} onChange={setStockStatus}
        options={[
          { value: "instock", label: "In Stock" },
          { value: "outofstock", label: "Out of Stock" },
          { value: "onbackorder", label: "On Backorder" },
        ]}
      />
      <EditableRow label="SKU" value={sku} onChange={setSku} />
      <EditableRow label="GTIN" value={gtin} onChange={setGtin} />
      <EditableRow label="UPC" value={upc} onChange={setUpc} />
      <EditableRow label="EAN" value={ean} onChange={setEan} />
      <EditableRow label="Tags" value={tags} onChange={setTags} />
    </>
  );

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Product Info</h3>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="text-xs text-blue-400 hover:text-blue-300">Edit</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-400">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="text-xs text-green-400 hover:text-green-300 disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>
      <div className="space-y-2 text-sm">
        {editing ? editMode : viewMode}
      </div>
    </div>
  );
}

function SelectRow({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-[60%] rounded border border-gray-700 bg-gray-800 px-2 py-1 text-right text-sm text-gray-300 focus:border-blue-500 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="max-w-[60%] truncate text-right text-gray-300">{value}</span>
    </div>
  );
}

function EditableRow({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-[60%] rounded border border-gray-700 bg-gray-800 px-2 py-1 text-right text-sm text-gray-300 focus:border-blue-500 focus:outline-none"
      />
    </div>
  );
}

interface HistoryItem {
  id: number;
  field: string;
  old_value: string;
  new_value: string;
  timestamp: string;
}

function timeAgo(timestamp: string): string {
  const hours = Math.floor((Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago${days < 7 ? ` (expires in ${7 - days}d)` : ""}`;
}

const FIELD_LABELS: Record<string, string> = {
  name: "Title",
  description: "Description",
  short_description: "Short Description",
  meta_title: "SEO Title",
  meta_description: "SEO Description",
  tags: "Tags",
};

function RecentChanges({ productId, onUndo }: { productId: number; onUndo: () => void }) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [undoingId, setUndoingId] = useState<number | null>(null);

  useEffect(() => {
    loadHistory();
  }, [productId]);

  async function loadHistory() {
    try {
      const res = await fetch(`/api/optimize/history?productId=${productId}`);
      const data = await res.json();
      setHistory(data.history || []);
    } catch {
      // non-critical, fail silently
    }
  }

  async function handleUndo(id: number) {
    setUndoingId(id);
    try {
      const res = await fetch("/api/optimize/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ historyId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Undo failed");
      toast.success(`Reverted ${FIELD_LABELS[data.restoredField] || data.restoredField}`);
      await loadHistory();
      onUndo();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Undo failed");
    } finally {
      setUndoingId(null);
    }
  }

  if (history.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-300">Recent Changes</h3>
      <div className="space-y-2">
        {history.map((h) => (
          <div key={h.id} className="flex items-center justify-between text-xs">
            <div className="min-w-0 flex-1">
              <span className="text-gray-300">{FIELD_LABELS[h.field] || h.field}</span>
              <span className="ml-1 text-gray-500">{timeAgo(h.timestamp)}</span>
            </div>
            <button
              onClick={() => handleUndo(h.id)}
              disabled={undoingId === h.id}
              className="ml-2 shrink-0 text-blue-400 hover:text-blue-300 disabled:opacity-50"
            >
              {undoingId === h.id ? "..." : "Undo"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImageManager({ product, onRefresh, onInsertInDesc }: {
  product: WCProduct;
  onRefresh: () => void;
  onInsertInDesc: (url: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [bulkUrls, setBulkUrls] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [working, setWorking] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Optimistic local state — mirrors product.images but updates instantly
  const [localImages, setLocalImages] = useState<{ id: number; src: string; name: string; alt: string; position: number }[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (product.images) {
      setLocalImages(product.images.map((img, i) => ({
        id: img.id,
        src: img.src,
        name: img.name || "",
        alt: img.alt || "",
        position: img.position ?? i,
      })));
      setInitialized(true);
    }
  }, [product.images]);

  const nextId = () => -(Date.now() + Math.floor(Math.random() * 10000));

  function addImageOptimistic(src: string, name: string) {
    const newImg = { id: nextId(), src, name, alt: "", position: localImages.length };
    setLocalImages((prev) => {
      const updated = [...prev, newImg];
      return updated.map((img, i) => ({ ...img, position: i }));
    });
  }

  function removeImageOptimistic(imageId: number) {
    setLocalImages((prev) => prev.filter((img) => img.id !== imageId).map((img, i) => ({ ...img, position: i })));
  }

  function reorderImageOptimistic(fromIdx: number, toIdx: number) {
    setLocalImages((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIdx, 1);
      updated.splice(toIdx, 0, moved);
      return updated.map((img, i) => ({ ...img, position: i }));
    });
  }

  async function apiCall(action: string, data: Record<string, unknown> = {}) {
    setWorking(Date.now());
    try {
      const res = await fetch("/api/products/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, action, ...data }),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = text;
        try { const j = JSON.parse(text); msg = j.error || msg; } catch {}
        throw new Error(msg);
      }
      const label = action === "add" || action === "bulk-add" ? "added" : action === "remove" ? "removed" : "reordered";
      toast.success(`Image ${label}`);
      setNewUrl("");
      setNewName("");
      setBulkUrls("");
      setBulkMode(false);
      if (action !== "reorder") setAdding(false);
      onRefresh();
    } catch (err) {
      // On error, revert by refreshing
      onRefresh();
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setWorking(null);
    }
  }

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are supported");
      return;
    }
    const name = file.name.replace(/\.[^/.]+$/, "");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const text = await res.text();
        let msg = text;
        try { const j = JSON.parse(text); msg = j.error || msg; } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      addImageOptimistic(data.url, name);
      await apiCall("add", { imageUrl: data.url, imageName: name });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    setAdding(true);
    for (const file of files) {
      await uploadFile(file);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setAdding(true);
    for (const file of files) {
      await uploadFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleBulkAdd() {
    const urls = bulkUrls.split("\n").map(l => l.trim()).filter(l => l.startsWith("http"));
    if (urls.length === 0) {
      toast.error("Paste at least one URL starting with https://");
      return;
    }
    for (const url of urls) {
      addImageOptimistic(url, "");
    }
    await apiCall("bulk-add", { imageUrls: urls });
  }

  function handleRemove(imageId: number) {
    removeImageOptimistic(imageId);
    apiCall("remove", { imageId });
  }

  function moveImage(fromIdx: number, direction: "up" | "down") {
    const toIdx = direction === "up" ? fromIdx - 1 : fromIdx + 1;
    if (toIdx < 0 || toIdx >= localImages.length) return;
    reorderImageOptimistic(fromIdx, toIdx);
    apiCall("reorder", { imageId: localImages[fromIdx].id, position: toIdx });
  }

  const images = initialized ? localImages : (product.images || []);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-300">
          <ImageIcon className="h-4 w-4" /> Images ({images.length})
        </h3>
        <button
          onClick={() => setAdding(!adding)}
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
        >
          <Plus className="h-3 w-3" /> Add Image
        </button>
      </div>

      {adding && (
        <div className="mb-4 space-y-2 rounded-lg border border-blue-800 bg-blue-900/20 p-3">
          {!bulkMode ? (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
                  dragOver ? "border-blue-400 bg-blue-500/10" : "border-gray-600 hover:border-gray-500"
                }`}
              >
                <Upload className={`mb-2 h-6 w-6 ${dragOver ? "text-blue-400" : "text-gray-500"}`} />
                <p className="text-sm text-gray-400">
                  {uploading ? "Uploading..." : "Drop images here or click to browse"}
                </p>
                <p className="text-xs text-gray-500">JPEG, PNG, GIF, WebP</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Or paste image URL (https://...)"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={() => apiCall("add", { imageUrl: newUrl, imageName: newName })}
                  disabled={!newUrl.trim() || working !== null}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {working ? "Adding..." : "Add URL"}
                </button>
              </div>
              <button onClick={() => setBulkMode(true)} className="text-xs text-blue-400 hover:text-blue-300">Paste multiple URLs instead</button>
            </>
          ) : (
            <>
              <textarea
                placeholder="Paste image URLs, one per line&#10;https://..."
                value={bulkUrls}
                onChange={(e) => setBulkUrls(e.target.value)}
                rows={5}
                className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleBulkAdd}
                  disabled={!bulkUrls.trim() || working !== null}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {working ? "Adding..." : `Add All (${bulkUrls.split("\n").filter(l => l.trim().startsWith("http")).length || 0})`}
                </button>
                <button onClick={() => setBulkMode(false)} className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-gray-300 hover:bg-gray-600">
                  Single URL
                </button>
              </div>
            </>
          )}
          <button
            onClick={() => { setAdding(false); setNewUrl(""); setNewName(""); setBulkUrls(""); setBulkMode(false); }}
            className="text-xs text-gray-500 hover:text-gray-400"
          >
            Cancel
          </button>
        </div>
      )}

      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((img, i) => (
            <div key={img.id} className="group relative">
              <img src={img.src} alt={img.alt || product.name} className="aspect-square w-full rounded-lg object-cover" />
              <div className="absolute left-1 top-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">
                #{i + 1}
              </div>
              <button
                onClick={() => onInsertInDesc(img.src)}
                className="absolute right-1 top-1 hidden rounded bg-gray-800/80 px-1.5 py-0.5 text-[10px] text-blue-400 group-hover:block hover:text-blue-300"
                title="Copy image HTML for pasting into description"
              >
                &lt;img&gt;
              </button>
              <div className="absolute inset-0 flex items-center justify-center gap-1 rounded-lg bg-black/70 opacity-0 transition-opacity group-hover:opacity-100">
                {i > 0 && (
                  <button
                    onClick={() => moveImage(i, "up")}
                    disabled={working !== null}
                    className="rounded bg-gray-700 p-1.5 text-white hover:bg-gray-600 disabled:opacity-50"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                )}
                {i < images.length - 1 && (
                  <button
                    onClick={() => moveImage(i, "down")}
                    disabled={working !== null}
                    className="rounded bg-gray-700 p-1.5 text-white hover:bg-gray-600 disabled:opacity-50"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={() => {
                    if (confirm(`Remove image #${i + 1}?`)) apiCall("remove", { imageId: img.id });
                  }}
                  disabled={working !== null}
                  className="rounded bg-red-600 p-1.5 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 p-8">
          <ImageIcon className="mb-2 h-8 w-8 text-gray-600" />
          <p className="text-sm text-gray-500">No images yet.</p>
          <button
            onClick={() => setAdding(true)}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300"
          >
            Click "Add Image" to upload from your computer, paste a URL, or bulk-import from FirstShop
          </button>
        </div>
      )}
    </div>
  );
}
