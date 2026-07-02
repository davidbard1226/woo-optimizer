import { getSetting } from "./db";
import { AIGeneratedContent, WCProduct } from "./types";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

function getApiKey(): string {
  return getSetting("openrouter_api_key") || process.env.OPENROUTER_API_KEY || "";
}

function getModel(): string {
  return getSetting("ai_model") || process.env.AI_MODEL || "nvidia/nemotron-3-nano-30b-a3b:free";
}

// Fallback chain tried in order if the preferred model is rate-limited or unavailable.
// Free OpenRouter models change frequently, so this list trades off recency vs reliability.
const MODEL_FALLBACK_CHAIN = [
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "google/gemini-2.0-flash-exp:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "qwen/qwen-2.5-7b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
];

function cleanAIOutput(text: string): string {
  // Remove <think> blocks (including nested, multiline)
  let clean = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  // Also remove partial think blocks (opened but not closed)
  clean = clean.replace(/<think>[\s\S]*/gi, "").trim();
  // Remove **bold** wrapper lines that are just labels like **Product Title:**
  clean = clean.replace(/^\*\*[^*]+:\*\*\s*/gm, "");
  // Remove lines that are clearly reasoning/meta/commentary
  const badPatterns = [
    /^we need to/i, /^let's/i, /^i need to/i, /^i should/i, /^first,/i,
    /^the user/i, /^hmm/i, /^okay/i, /^so we/i, /^well,/i, /^thinking/i,
    /^reasoning/i, /^analysis/i, /^step \d/i, /^make sure/i, /^make \d/i,
    /^each line/i, /^that's \d/i, /^possibly include/i, /^we have product/i,
    /^output only/i, /^provide exactly/i, /^no extra/i, /^just output/i,
    /^must output/i, /^must be/i, /^let's output/i, /^let's produce/i,
    /^we can follow/i, /^we can produce/i, /^here are/i, /^here is/i,
    /^example shows/i, /^example:/i, /^so we can/i, /^so we need/i,
    /^make 5/i, /^provide 5/i, /^note:/i, /^important:/i, /^tip:/i,
    /^as an ai/i, /^as a helpful/i, /^i'm an/i, /^i am an/i,
    /^based on/i, /^given the/i, /^for the product/i, /^for this product/i,
    /^this product/i, /^the product/i, /^this is/i, /^the following/i,
    /^please note/i, /^bear in mind/i, /^keep in mind/i,
    /^since the/i, /^given that/i, /^considering/i, /^taking into/i,
    /^we can see/i, /^we can tell/i, /^it appears/i, /^it seems/i,
    /^therefore/i, /^thus/i, /^consequently/i, /^in conclusion/i,
    /^to summarize/i, /^in summary/i, /^overall/i, /^in short/i,
    /^briefly/i, /^moving on/i, /^next,/i, /^finally,/i,
    /^title:/i, /^description:/i, /^short description:/i, /^tags:/i,
    /^seo/i, /^meta/i,
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
  const response = await callAI(`Generate an SEO-optimized product title (max 70 characters) for:

${context}

Rules:
- Include the brand and key product name
- Include important specs (capacity, size, compatibility)
- Use keywords customers search for on Google
- Keep under 70 characters
- No quotes, no labels, just the title`, 100);
  return response.replace(/^["']|["']$/g, "").trim();
}

export async function generateDescription(product: WCProduct): Promise<string> {
  const context = buildProductContext(product);
  return callAI(`Write a compelling product description in HTML for:

${context}

Rules:
- Use HTML tags: <p>, <strong>, <ul>, <li>
- 200-500 words
- Include keywords for Google SEO
- Highlight benefits and features
- Write in persuasive marketing language
- Price is in South African Rands (ZAR)`, 2048);
}

export async function generateShortDescription(product: WCProduct): Promise<string> {
  const context = buildProductContext(product);
  return callAI(`Write a 1-2 sentence product summary for:

${context}

Plain text only. No HTML. Under 300 characters. Include the key selling point.`, 256);
}

export async function generateBulletPoints(product: WCProduct): Promise<string[]> {
  const context = buildProductContext(product);
  const response = await callAI(`Write 5-8 product feature bullet points for:

${context}

One per line. Format: Feature Name: description
Example:
Compatibility: Works with Olivetti 3524MF printers
Page Yield: Up to 8,000 pages at 5% coverage`, 512);

  return response
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter((l) => l.includes(":") && l.length > 10);
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
  const [title, description, shortDescription, bulletPoints, seo, tags] = await Promise.all([
    generateTitle(product),
    generateDescription(product),
    generateShortDescription(product),
    generateBulletPoints(product),
    generateSEO(product),
    generateTags(product),
  ]);

  const bulletHtml = bulletPoints.length > 0
    ? `\n<ul>\n${bulletPoints.map((b) => `  <li>${b}</li>`).join("\n")}\n</ul>`
    : "";

  return {
    name: title,
    description: description + bulletHtml,
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
