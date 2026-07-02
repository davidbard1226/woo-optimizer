import { getSetting } from "./db";
import { AIGeneratedContent, WCProduct } from "./types";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

function getApiKey(): string {
  return getSetting("openrouter_api_key") || process.env.OPENROUTER_API_KEY || "";
}

function getModel(): string {
  return getSetting("ai_model") || process.env.AI_MODEL || "deepseek/deepseek-chat-v3-0324:free";
}

// Fallback chain tried in order if the preferred model is rate-limited or unavailable.
const MODEL_FALLBACK_CHAIN = [
  "google/gemini-2.0-flash-exp:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  "qwen/qwen-2.5-7b-instruct:free",
];

function cleanAIOutput(text: string): string {
  // Remove <think> blocks (including nested, multiline)
  let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  clean = clean.replace(/<think>[\s\S]*/gi, "").trim();
  clean = clean.replace(/^\*\*[^*]+:\*\*\s*/gm, "");
  // Remove lines that are instructions/rules/thinking leaked into output
  const badPatterns = [
    /^we need/i, /^let'?s /i, /^i need/i, /^i should/i, /^i will/i,
    /^first[,:]?\s/i, /^the user/i, /^hmm/i, /^okay[,:]?\s/i, /^so we/i,
    /^well[,:]?\s/i, /^thinking/i, /^reasoning/i, /^analysis/i,
    /^step \d/i, /^make sure/i, /^each line/i, /^possibly include/i,
    /^we have product/i, /^output only/i, /^provide exactly/i,
    /^no extra/i, /^just output/i, /^must output/i, /^must be/i,
    /^let'?s output/i, /^let'?s produce/i, /^we can follow/i,
    /^we can produce/i, /^here are/i, /^here is/i, /^example shows/i,
    /^so we can/i, /^so we need/i, /^make 5/i, /^provide 5/i,
    /^note:/i, /^important:/i, /^tip:/i, /^as an ai/i, /^as a helpful/i,
    /^i'm an/i, /^i am an/i, /^based on/i, /^given the/i,
    /^for the product/i, /^for this product/i, /^this product/i,
    /^the product/i, /^this is/i, /^the following/i, /^please note/i,
    /^bear in mind/i, /^keep in mind/i, /^since the/i, /^given that/i,
    /^considering/i, /^taking into/i, /^we can see/i, /^we can tell/i,
    /^it appears/i, /^it seems/i, /^therefore[,:]?\s/i, /^thus[,:]?\s/i,
    /^consequently/i, /^in conclusion/i, /^to summarize/i,
    /^in summary/i, /^overall[,:]?\s/i, /^in short/i, /^briefly/i,
    /^moving on/i, /^next[,:]?\s/i, /^finally[,:]?\s/i,
    /^title:/i, /^description:/i, /^short description:/i, /^tags:/i,
    /^seo/i, /^meta/i, /^rules?:/i, /^instructions?:/i,
    /^guidelines?:/i, /^constraints?:/i, /^requirements?:/i,
    /^need.*char/i, /^under \d+ char/i, /^\d+-\d+ (sentence|word|bullet)/i,
    /^plain text/i, /^no html/i, /^no markdown/i, /^no formatting/i,
    /^one per line/i, /^max \d+/i, /^keep under/i, /^include the/i,
    /^output only/i, /^just the/i, /^use keywords/i,
  ];
  const lines = clean.split("\n");
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const isBad = badPatterns.some((p) => p.test(trimmed));
    if (!isBad) {
      result.push(line);
    }
  }
  return result.join("\n").trim();
}

let lastModelUsed = "";

export function getLastModelUsed(): string {
  return lastModelUsed;
}

async function callAI(prompt: string, maxTokens = 2048): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("OpenRouter API key not configured. Go to Settings to add it.");

  const preferredModel = getModel();
  const modelsToTry = [preferredModel, ...MODEL_FALLBACK_CHAIN.filter((m) => m !== preferredModel)];

  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "WooCommerce AI Optimizer",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: "You are an expert e-commerce copywriter for a South African store. CRITICAL RULES: 1) Output ONLY the final requested content. 2) NEVER include reasoning, analysis, thinking, explanations, or meta-commentary. 3) NEVER prefix with labels like 'Title:', 'Description:'. 4) NEVER say 'based on the product' or similar. 5) Just output the raw content directly. If you need to think, do it silently.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });

      // Rate-limited or model temporarily unavailable -> try next model in chain
      if (response.status === 429 || response.status === 503) {
        lastError = new Error(`${model} rate-limited/unavailable (${response.status})`);
        continue;
      }

      if (!response.ok) {
        const err = await response.text();
        lastError = new Error(`${model} error (${response.status}): ${err}`);
        continue;
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content || "";

      if (!raw.trim()) {
        lastError = new Error(`${model} returned empty content`);
        continue;
      }

      lastModelUsed = model;
      return cleanAIOutput(raw);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Unknown error calling AI");
      continue;
    }
  }

  throw new Error(`All AI models failed. Last error: ${lastError?.message || "unknown"}`);
}

function buildProductContext(product: WCProduct): string {
  const cleanDesc = product.description?.replace(/<[^>]*>/g, "").trim() || "No description";
  const cleanShortDesc = product.short_description?.replace(/<[^>]*>/g, "").trim() || "No short description";
  const categories = product.categories?.map((c) => c.name).join(", ") || "None";
  const attributes = product.attributes?.map((a) => `${a.name}: ${a.options.join(", ")}`).join("; ") || "None";
  const imageCount = product.images?.length || 0;

  return `Product Name: ${product.name}
SKU: ${product.sku || "N/A"}
Price: R${product.price || product.regular_price || "N/A"}
Categories: ${categories}
Attributes: ${attributes}
Images: ${imageCount} image(s)
Current Description: ${cleanDesc}
Current Short Description: ${cleanShortDesc}`.trim();
}

export async function generateTitle(product: WCProduct): Promise<string> {
  const context = buildProductContext(product);
  const response = await callAI(`Output only the SEO title for this product:

${context}

Rules: include brand, key specs, SEO keywords. Max 70 chars. No explanations. No labels. Just the title.`, 100);
  // Strip any remaining label-like prefixes
  let clean = response.replace(/^(title|product|name|seo title|output|result):\s*/i, "").trim();
  clean = clean.replace(/^["']|["']$/g, "").trim();
  return clean;
}

export async function generateDescription(product: WCProduct): Promise<string> {
  const context = buildProductContext(product);
  return callAI(`Write a compelling product description in HTML for:

${context}

Rules:
- Use HTML tags: <p>, <strong>
- 200-500 words
- Do NOT include bullet points — they will be in the short description
- Include keywords for Google SEO
- Highlight benefits and features
- Write in persuasive marketing language
- Price is in South African Rands (ZAR)`, 2048);
}

export async function generateShortDescription(product: WCProduct, bulletPoints: string[] = []): Promise<string> {
  const bullets = bulletPoints.slice(0, 5);
  if (bullets.length > 0) {
    return bullets.map((b) => "• " + b).join("\n");
  }
  const context = buildProductContext(product);
  const summary = await callAI(`List key features for:

${context}

Output only bullet points, one per line, each starting with •. Max 5. No sentences. No labels.`, 256);
  return summary;
}

export async function generateBulletPoints(product: WCProduct): Promise<string[]> {
  const context = buildProductContext(product);
  const response = await callAI(`Write 5 product feature bullet points for:

${context}

One per line. Format: Feature Name: description
Example:
Speed: Up to 25 ppm for efficient workflow
Capacity: 128GB of reliable storage

Output exactly 5 bullets, no more.`, 512);

  return response
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter((l) => l.includes(":") && l.length > 10)
    .slice(0, 5);
}

export async function generateSEO(product: WCProduct): Promise<{
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
}> {
  const context = buildProductContext(product);
  const response = await callAI(`Generate SEO metadata for:

${context}

Return ONLY in this format:
META_TITLE: [under 60 chars]
META_DESCRIPTION: [under 160 chars with call-to-action]
FOCUS_KEYWORD: [main search keyword]`, 256);

  return {
    metaTitle: response.match(/META_TITLE:\s*(.+)/i)?.[1]?.trim() || product.name,
    metaDescription: response.match(/META_DESCRIPTION:\s*(.+)/i)?.[1]?.trim() || "",
    focusKeyword: response.match(/FOCUS_KEYWORD:\s*(.+)/i)?.[1]?.trim() || "",
  };
}

export async function generateTags(product: WCProduct): Promise<string[]> {
  const context = buildProductContext(product);
  const response = await callAI(`Generate 5-10 product tags/keywords for:

${context}

One tag per line. Lowercase. No hashtags. Example:
toner cartridge
olivetti compatible
high capacity`, 256);

  return response
    .split("\n")
    .map((l) => l.replace(/^[-•*#]\s*/, "").trim().toLowerCase())
    .filter((l) => l.length > 2 && l.length < 40);
}

export async function generateAll(product: WCProduct): Promise<AIGeneratedContent> {
  const [title, description, bulletPoints, seo, tags] = await Promise.all([
    generateTitle(product),
    generateDescription(product),
    generateBulletPoints(product),
    generateSEO(product),
    generateTags(product),
  ]);

  const shortDescription = await generateShortDescription(product, bulletPoints);

  // Embed product images into the description HTML for SEO
  const images = product.images || [];
  let descWithImages = description;
  if (images.length > 0) {
    const imgTags = images
      .slice(0, 3)
      .map((img) => `<img src="${img.src}" alt="${img.alt || product.name}" style="max-width:100%;height:auto;margin:12px 0" />`)
      .join("\n");

    // Insert images after first paragraph
    const firstP = descWithImages.indexOf("</p>");
    if (firstP !== -1) {
      descWithImages =
        descWithImages.slice(0, firstP + 4) +
        "\n" + imgTags + "\n" +
        descWithImages.slice(firstP + 4);
    } else {
      descWithImages = imgTags + "\n" + descWithImages;
    }
  }

  return {
    name: title,
    description: descWithImages,
    shortDescription,
    bulletPoints,
    metaTitle: seo.metaTitle,
    metaDescription: seo.metaDescription,
    focusKeyword: seo.focusKeyword,
    tags,
    modelUsed: lastModelUsed,
  };
}

export async function testAIConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const apiKey = getApiKey();
    if (!apiKey) return { success: false, message: "No API key configured" };
    await callAI("Say OK", 10);
    return { success: true, message: `Connected! Model: ${getModel()}` };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Connection failed" };
  }
}
