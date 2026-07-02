export interface WCProduct {
  id: number;
  name: string;
  slug: string;
  status: "publish" | "draft" | "pending" | "private";
  description: string;
  short_description: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  images: WCImage[];
  categories: WCCategory[];
  attributes: WCAttribute[];
  tags: WCTag[];
  date_created: string;
  date_modified: string;
  stock_status: string;
  permalink: string;
  featured: boolean;
  [key: string]: unknown;
}

export interface WCImage {
  id: number;
  src: string;
  name: string;
  alt: string;
  position?: number;
}

export interface WCCategory {
  id: number;
  name: string;
  slug: string;
}

export interface WCAttribute {
  id: number;
  name: string;
  options: string[];
}

export interface WCTag {
  id: number;
  name: string;
  slug: string;
}

export interface HealthScore {
  total: number;
  breakdown: {
    description: number;
    shortDescription: number;
    images: number;
    imageAlts: number;
    categories: number;
    sku: number;
    price: number;
    attributes: number;
  };
}

export interface AIGeneratedContent {
  name?: string;
  description: string;
  shortDescription: string;
  bulletPoints: string[];
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  tags?: string[];
  modelUsed?: string;
}

export interface ImageAuditResult {
  productId: number;
  productName: string;
  issues: ImageIssue[];
}

export interface ImageIssue {
  imageId: number;
  imageSrc: string;
  type: "missing_alt" | "empty_alt" | "broken_url" | "no_images";
  severity: "critical" | "warning" | "info";
  message: string;
}

export interface Settings {
  wc_url: string;
  wc_consumer_key: string;
  wc_consumer_secret: string;
  ollama_host: string;
  ollama_model: string;
}

export interface OptimizationHistory {
  id: number;
  product_id: number;
  product_name: string;
  field: string;
  old_value: string;
  new_value: string;
  timestamp: string;
}
