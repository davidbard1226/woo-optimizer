import { WCProduct, HealthScore } from "./types";

export function calculateHealthScore(product: WCProduct): HealthScore {
  const breakdown = {
    description: scoreDescription(product.description),
    shortDescription: scoreShortDescription(product.short_description),
    images: scoreImages(product.images),
    imageAlts: scoreImageAlts(product.images),
    categories: scoreCategories(product.categories),
    sku: scoreSku(product.sku),
    price: scorePrice(product.price, product.regular_price),
    attributes: scoreAttributes(product.attributes),
  };

  const total = Math.round(
    Object.values(breakdown).reduce((sum, val) => sum + val, 0) / Object.keys(breakdown).length
  );

  return { total, breakdown };
}

function scoreDescription(desc: string): number {
  if (!desc || desc.trim().length === 0) return 0;
  const clean = desc.replace(/<[^>]*>/g, "").trim();
  if (clean.length < 50) return 20;
  if (clean.length < 150) return 40;
  if (clean.length < 300) return 60;
  if (clean.length < 600) return 80;
  return 100;
}

function scoreShortDescription(shortDesc: string): number {
  if (!shortDesc || shortDesc.trim().length === 0) return 0;
  const clean = shortDesc.replace(/<[^>]*>/g, "").trim();
  if (clean.length < 20) return 30;
  if (clean.length < 80) return 60;
  return 100;
}

function scoreImages(images: WCProduct["images"]): number {
  if (!images || images.length === 0) return 0;
  if (images.length === 1) return 30;
  if (images.length === 2) return 60;
  if (images.length <= 4) return 80;
  return 100;
}

function scoreImageAlts(images: WCProduct["images"]): number {
  if (!images || images.length === 0) return 0;
  const withAlts = images.filter((img) => img.alt && img.alt.trim().length > 0).length;
  const ratio = withAlts / images.length;
  return Math.round(ratio * 100);
}

function scoreCategories(categories: WCProduct["categories"]): number {
  if (!categories || categories.length === 0) return 0;
  if (categories.length === 1) return 50;
  return 100;
}

function scoreSku(sku: string): number {
  if (!sku || sku.trim().length === 0) return 0;
  return 100;
}

function scorePrice(price: string, regularPrice: string): number {
  const p = parseFloat(price);
  const rp = parseFloat(regularPrice);
  if (isNaN(p) || p <= 0) return 0;
  if (!isNaN(rp) && rp > 0) return 100;
  return 50;
}

function scoreAttributes(attributes: WCProduct["attributes"]): number {
  if (!attributes || attributes.length === 0) return 30;
  if (attributes.length <= 2) return 60;
  if (attributes.length <= 4) return 80;
  return 100;
}

export function getHealthLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Excellent", color: "text-green-400" };
  if (score >= 60) return { label: "Good", color: "text-blue-400" };
  if (score >= 40) return { label: "Needs Work", color: "text-yellow-400" };
  if (score >= 20) return { label: "Poor", color: "text-orange-400" };
  return { label: "Critical", color: "text-red-400" };
}
