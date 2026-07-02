import { WCProduct } from "./types";
import { getSetting } from "./db";
import fs from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), "data", "cache");
const CACHE_TTL = 5 * 60 * 1000;
const FETCH_TIMEOUT = 8000;

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCache(key: string): unknown | null {
  try {
    ensureCacheDir();
    const filePath = path.join(CACHE_DIR, `${key.replace(/[^a-zA-Z0-9]/g, "_")}.json`);
    if (!fs.existsSync(filePath)) return null;
    const entry: CacheEntry = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (Date.now() - entry.timestamp > CACHE_TTL) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function setCache(key: string, data: unknown) {
  try {
    ensureCacheDir();
    const filePath = path.join(CACHE_DIR, `${key.replace(/[^a-zA-Z0-9]/g, "_")}.json`);
    fs.writeFileSync(filePath, JSON.stringify({ data, timestamp: Date.now() }), "utf-8");
  } catch {}
}

function getAuth() {
  const wcUrl = getSetting("wc_url") || process.env.WC_URL || "";
  const consumerKey = getSetting("wc_consumer_key") || process.env.WC_CONSUMER_KEY || "";
  const consumerSecret = getSetting("wc_consumer_secret") || process.env.WC_CONSUMER_SECRET || "";
  return { consumerKey, consumerSecret, wcUrl };
}

function getBaseUrl(): string {
  const { wcUrl } = getAuth();
  if (!wcUrl) throw new Error("WooCommerce URL not configured. Go to Settings to configure.");
  return `${wcUrl.replace(/\/+$/, "")}/wp-json/wc/v3`;
}

function getAuthParams(): string {
  const { consumerKey, consumerSecret } = getAuth();
  if (!consumerKey || !consumerSecret) throw new Error("WooCommerce API keys not configured.");
  return `consumer_key=${consumerKey}&consumer_secret=${consumerSecret}`;
}

async function wcFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchProducts(params: {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  orderby?: string;
  order?: string;
} = {}): Promise<{ products: WCProduct[]; total: number; totalPages: number }> {
  const cacheKey = `products_${JSON.stringify(params)}`;
  const cached = getCache(cacheKey);
  if (cached) return cached as { products: WCProduct[]; total: number; totalPages: number };

  const baseUrl = getBaseUrl();
  const authParams = getAuthParams();

  const searchParams = new URLSearchParams(authParams);
  if (params.page) searchParams.set("page", String(params.page));
  searchParams.set("per_page", String(params.per_page || 20));
  if (params.search) searchParams.set("search", params.search);
  if (params.status && params.status !== "any") searchParams.set("status", params.status);
  if (params.orderby) searchParams.set("orderby", params.orderby);
  if (params.order) searchParams.set("order", params.order);

  const url = `${baseUrl}/products?${searchParams.toString()}`;
  const response = await wcFetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WooCommerce API error (${response.status}): ${text}`);
  }

  const products: WCProduct[] = await response.json();
  const total = parseInt(response.headers.get("X-WP-Total") || "0", 10);
  const totalPages = parseInt(response.headers.get("X-WP-TotalPages") || "0", 10);

  const result = { products, total, totalPages };
  setCache(cacheKey, result);
  return result;
}

export async function fetchProduct(id: number): Promise<WCProduct> {
  const cacheKey = `product_${id}`;
  const cached = getCache(cacheKey);
  if (cached) return cached as WCProduct;

  const baseUrl = getBaseUrl();
  const authParams = getAuthParams();
  const url = `${baseUrl}/products/${id}?${authParams}`;

  const response = await wcFetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WooCommerce API error (${response.status}): ${text}`);
  }

  const product = await response.json();
  setCache(cacheKey, product);
  return product;
}

export async function fetchProductBySku(sku: string): Promise<WCProduct | null> {
  const baseUrl = getBaseUrl();
  const authParams = getAuthParams();
  const url = `${baseUrl}/products?${authParams}&sku=${encodeURIComponent(sku)}`;

  const response = await wcFetch(url);
  if (!response.ok) return null;

  const products: WCProduct[] = await response.json();
  return products.length > 0 ? products[0] : null;
}

export async function updateProduct(id: number, data: Partial<WCProduct>): Promise<WCProduct> {
  const baseUrl = getBaseUrl();
  const authParams = getAuthParams();
  const url = `${baseUrl}/products/${id}?${authParams}`;

  const response = await wcFetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WooCommerce API error (${response.status}): ${text}`);
  }

  try {
    const cacheFile = path.join(CACHE_DIR, `product_${id}.json`);
    if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile);
  } catch {}

  return response.json();
}

export async function createProduct(data: Record<string, unknown>): Promise<WCProduct> {
  const baseUrl = getBaseUrl();
  const authParams = getAuthParams();
  const url = `${baseUrl}/products?${authParams}`;

  const response = await wcFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WooCommerce API error (${response.status}): ${text}`);
  }

  return response.json();
}

export async function testConnection(): Promise<{ success: boolean; message: string; storeName?: string }> {
  try {
    const baseUrl = getBaseUrl();
    const authParams = getAuthParams();
    const url = `${baseUrl}/system_status?${authParams}`;
    const response = await wcFetch(url);
    if (!response.ok) throw new Error("Invalid credentials");
    const data = (await response.json()) as { settings?: { site_url?: string; store_name?: string } };
    return { success: true, message: "Connected successfully", storeName: data.settings?.store_name };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Connection failed" };
  }
}
