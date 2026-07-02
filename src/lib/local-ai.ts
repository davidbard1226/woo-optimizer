import { WCProduct, AIGeneratedContent } from "./types";

function extractSpecs(product: WCProduct): string[] {
  const specs: string[] = [];
  if (product.attributes) {
    for (const attr of product.attributes) {
      if (attr.options) specs.push(...attr.options.filter(Boolean));
    }
  }
  const desc = (product.description || "") + " " + (product.short_description || "");
  const matches = desc.match(/\b\d+\s*(GB|TB|MHz|GHz|MB\/s|GB\/s|ppm|dpi|W|mm|cm|inch|cores|threads)\b/gi);
  if (matches) specs.push(...matches.slice(0, 8));
  return Array.from(new Set(specs)).slice(0, 10);
}

function extractCategory(product: WCProduct): string {
  return product.categories?.map((c) => c.name).join(", ") || "";
}

function cleanDesc(text: string): string {
  return text?.replace(/<[^>]*>/g, "").trim() || "";
}

export function generateLocalTitle(product: WCProduct): string {
  const name = product.name || "";
  const sku = product.sku || "";
  const cat = extractCategory(product);
  let title = name;

  // If title is too long, try to shorten it
  if (title.length > 70) {
    // Remove text after key delimiters
    const delimiters = [" | ", " - ", " — ", " / "];
    for (const d of delimiters) {
      const parts = title.split(d);
      if (parts.length > 1) {
        title = parts[0] + (parts[1].length < 30 ? d + parts[1] : "");
      }
      if (title.length <= 70) break;
    }
  }

  return title.slice(0, 70);
}

export function generateLocalShortDescription(product: WCProduct): string {
  const name = product.name || "";
  const price = product.price || product.regular_price || "";
  const cat = extractCategory(product);
  const specs = extractSpecs(product);

  const bullets: string[] = [];
  if (specs.length > 0) {
    const used = new Set<string>();
    for (const spec of specs) {
      if (bullets.length >= 5) break;
      const key = spec.replace(/[\d\s]/g, "").trim();
      if (!key || used.has(key)) continue;
      used.add(key);
      const label = key.length > 15 ? key : key + " Spec";
      bullets.push(`• ${label}: ${spec}`);
    }
  }

  if (bullets.length < 5 && cat) {
    const catParts = cat.split(",").map((c) => c.trim()).filter(Boolean);
    for (const c of catParts) {
      if (bullets.length >= 5) break;
      bullets.push(`• Category: ${c}`);
    }
  }

  if (bullets.length < 5) {
    const extras = [
      `• Reliable ${extractCategory(product) || "quality"} performance`,
      `• Ideal for home and office use`,
    ];
    for (const e of extras) {
      if (bullets.length >= 5) break;
      if (!bullets.some((b) => b.includes(e.slice(2, 15)))) bullets.push(e);
    }
  }

  return bullets.join("\n");
}

export function generateLocalFullDescription(product: WCProduct): string {
  const name = product.name || "";
  const price = product.price || product.regular_price || "";
  const shortDesc = cleanDesc(product.short_description);
  const desc = cleanDesc(product.description);
  const specs = extractSpecs(product);
  const cat = extractCategory(product);
  const images = product.images || [];

  const paragraphs: string[] = [];

  // Intro
  const intro = `Introducing the ${name}, a high-quality product designed to meet your needs. Whether you're at home, in the office, or on the go, this ${cat || "versatile device"} delivers reliable performance you can count on.`;
  paragraphs.push(`<p>${intro}</p>`);

  // Key specs paragraph
  if (specs.length > 0) {
    paragraphs.push(`<p>Key specifications include: ${specs.join(", ")}. These features ensure optimal performance and compatibility with your existing setup.</p>`);
  }

  // Features from short description
  if (shortDesc && shortDesc.length > 20) {
    paragraphs.push(`<p>${shortDesc}</p>`);
  }

  // Original description
  if (desc && desc.length > 20) {
    paragraphs.push(`<p>${desc}</p>`);
  }

  // Price + CTA
  if (price) {
    paragraphs.push(`<p>Available now at R${price} — exceptional value for South African buyers. Upgrade your workflow today.</p>`);
  } else {
    paragraphs.push(`<p>Available now in South Africa. Order yours today and experience the difference.</p>`);
  }

  // Embed images
  let html = paragraphs.join("\n");
  const imgs = images.slice(0, 3);
  if (imgs.length > 0) {
    const imgHtml = imgs.map((img) =>
      `<img src="${img.src}" alt="${img.alt || name}" style="max-width:100%;height:auto;margin:12px 0" />`
    ).join("\n");
    const firstP = html.indexOf("</p>");
    if (firstP !== -1) {
      html = html.slice(0, firstP + 4) + "\n" + imgHtml + "\n" + html.slice(firstP + 4);
    }
  }

  return html;
}

export function generateLocalSEO(product: WCProduct): { metaTitle: string; metaDescription: string; focusKeyword: string } {
  const name = product.name || "";
  const cat = extractCategory(product);
  const specs = extractSpecs(product);
  const price = product.price || product.regular_price || "";

  const metaTitle = generateLocalTitle(product);
  const keyword = (name.split(" ").slice(0, 3).join(" ") || name).toLowerCase();
  const metaDescription = `Shop the ${name}${specs.length > 0 ? " with " + specs.slice(0, 3).join(", ") : ""}${price ? " for R" + price : ""}. ${cat ? cat + "." : ""} Fast shipping across South Africa.`;

  return {
    metaTitle: metaTitle.slice(0, 60),
    metaDescription: metaDescription.slice(0, 160),
    focusKeyword: keyword,
  };
}

export function generateLocalTags(product: WCProduct): string[] {
  const name = product.name || "";
  const cat = extractCategory(product);
  const tags: string[] = [];

  // Brand words
  const nameParts = name.toLowerCase().split(/[\s\-|]+/);
  for (const part of nameParts) {
    if (part.length > 2 && !["the", "and", "for", "with", "that", "this"].includes(part)) {
      tags.push(part);
    }
  }

  // Category words
  if (cat) {
    for (const c of cat.split(",")) {
      tags.push(c.trim().toLowerCase());
    }
  }

  return Array.from(new Set(tags)).filter((t) => !["with", "for", "the", "and", "n/a", ""].includes(t)).slice(0, 10);
}

export function generateLocalAll(product: WCProduct): AIGeneratedContent {
  const title = generateLocalTitle(product);
  const description = generateLocalFullDescription(product);
  const bulletPoints = generateLocalShortDescription(product).split("\n").map((b) => b.replace(/^•\s*/, "").trim()).filter(Boolean);
  const shortDescription = bulletPoints.map((b) => "• " + b).join("\n");
  const seo = generateLocalSEO(product);
  const tags = generateLocalTags(product);

  return {
    name: title,
    description,
    shortDescription,
    bulletPoints,
    metaTitle: seo.metaTitle,
    metaDescription: seo.metaDescription,
    focusKeyword: seo.focusKeyword,
    tags,
    modelUsed: "local-generator",
  };
}
