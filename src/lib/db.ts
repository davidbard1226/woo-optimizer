import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");
const BULK_RESULTS_FILE = path.join(DATA_DIR, "bulk-results.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson(filePath: string): unknown {
  ensureDataDir();
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return {};
  }
}

function writeJson(filePath: string, data: unknown) {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export function getSetting(key: string): string | null {
  const settings = readJson(SETTINGS_FILE) as Record<string, string>;
  return settings[key] ?? null;
}

export function setSetting(key: string, value: string): void {
  const settings = readJson(SETTINGS_FILE) as Record<string, string>;
  settings[key] = value;
  writeJson(SETTINGS_FILE, settings);
}

export function getAllSettings(): Record<string, string> {
  return readJson(SETTINGS_FILE) as Record<string, string>;
}

export function addOptimizationHistory(
  productId: number,
  productName: string,
  field: string,
  oldValue: string,
  newValue: string
): void {
  const HISTORY_RETENTION_DAYS = 7;
  const raw = readJson(HISTORY_FILE);
  const history = Array.isArray(raw) ? raw : [];
  const cutoff = Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const pruned = history.filter((h: { timestamp: string }) => new Date(h.timestamp).getTime() >= cutoff);
  pruned.push({
    id: Date.now() + Math.floor(Math.random() * 1000), // avoid collisions when several fields are added in the same ms
    product_id: productId,
    product_name: productName,
    field,
    old_value: oldValue,
    new_value: newValue,
    timestamp: new Date().toISOString(),
  });
  writeJson(HISTORY_FILE, pruned.slice(-500));
}

export function getOptimizationHistory(limit = 50): Array<{
  id: number;
  product_id: number;
  product_name: string;
  field: string;
  old_value: string;
  new_value: string;
  timestamp: string;
}> {
  const raw = readJson(HISTORY_FILE);
  const history = (Array.isArray(raw) ? raw : []) as Array<{
    id: number;
    product_id: number;
    product_name: string;
    field: string;
    old_value: string;
    new_value: string;
    timestamp: string;
  }>;
  return history.slice(-limit).reverse();
}

export function getHistoryEntry(id: number) {
  const raw = readJson(HISTORY_FILE);
  const history = Array.isArray(raw) ? raw : [];
  return history.find((h: { id: number }) => h.id === id) || null;
}

export function getHistoryForProduct(productId: number, limit = 10) {
  const raw = readJson(HISTORY_FILE);
  const history = (Array.isArray(raw) ? raw : []) as Array<{ product_id: number }>;
  return history
    .filter((h) => h.product_id === productId)
    .slice(-limit)
    .reverse();
}

// --- Bulk optimization results (generated content awaiting review) ---

export interface BulkResultEntry {
  productId: number;
  productName: string;
  content: unknown;
  generatedAt: string;
}

export function saveBulkResult(productId: number, productName: string, content: unknown): void {
  const raw = readJson(BULK_RESULTS_FILE);
  const results = (Array.isArray(raw) ? raw : []) as BulkResultEntry[];
  const filtered = results.filter((r) => r.productId !== productId);
  filtered.unshift({ productId, productName, content, generatedAt: new Date().toISOString() });
  writeJson(BULK_RESULTS_FILE, filtered.slice(0, 200));
}

export function getBulkResults(): BulkResultEntry[] {
  const raw = readJson(BULK_RESULTS_FILE);
  return (Array.isArray(raw) ? raw : []) as BulkResultEntry[];
}

export function removeBulkResult(productId: number): void {
  const raw = readJson(BULK_RESULTS_FILE);
  const results = (Array.isArray(raw) ? raw : []) as BulkResultEntry[];
  writeJson(BULK_RESULTS_FILE, results.filter((r) => r.productId !== productId));
}
