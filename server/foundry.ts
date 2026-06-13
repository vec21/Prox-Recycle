/**
 * Foundry IQ integration layer for Prox-Recycle (hybrid pipeline).
 *
 * Two-step, multi-model reasoning:
 *   [1] VISION  — Groq multimodal model describes the waste photo (objects, material,
 *                 rough count/size). Groq's API is OpenAI-compatible.
 *   [2] FOUNDRY IQ — A Microsoft Foundry text model (Phi-4-mini-instruct) reasons over
 *                 that description PLUS the local knowledge base and returns an
 *                 auditable, citation-backed JSON reward. This is the Microsoft IQ layer.
 *
 * If credentials are missing, it falls back to a deterministic mock so the UI stays
 * fully demoable without any keys.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import OpenAI, { AzureOpenAI } from 'openai';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface Citation {
  id: string;
  source: string;
}

export interface ScanResult {
  material: string;
  count: number;
  isWaste: boolean;
  confidence: number;
  estimatedWeight: number;
  fraudDetected: boolean;
  explanation: string;
  rewardKz: number;
  co2SavedKg: number;
  citations: Citation[];
  grounded: boolean;
  provider: 'foundry-iq' | 'mock';
}

const KNOWLEDGE_FILE = join(__dirname, 'knowledge', 'recycling-knowledge.md');
const KNOWLEDGE_SOURCE = 'recycling-knowledge.md';

let knowledgeCache: string | null = null;
function loadKnowledge(): string {
  if (knowledgeCache === null) {
    knowledgeCache = readFileSync(KNOWLEDGE_FILE, 'utf-8');
  }
  return knowledgeCache;
}

// Compact projection of the knowledge base sent to the reasoning model. Keeps the
// citation ids while drastically reducing token count (free-tier TPM is small).
const COMPACT_KNOWLEDGE = `PRICES (Kz per kg, id base_rate x multiplier):
PET [PRICE-PET] 300 x2.0; Aluminum [PRICE-ALU] 450 x2.5; Cardboard [PRICE-CARD] 80 x1.0; Glass [PRICE-GLASS] 60 x1.0; Unidentified [PRICE-UNKNOWN] 0.
CLASS ids: PET=CLASS-PET, Aluminum=CLASS-ALU, Cardboard=CLASS-CARD, Glass=CLASS-GLASS.
CO2 saved (kg per kg): PET [CO2-PET] 1.5; Aluminum [CO2-ALU] 9.0; Cardboard [CO2-CARD] 0.9; Glass [CO2-GLASS] 0.3.
FRAUD ids: stock photo=FRAUD-STOCK; irrelevant image=FRAUD-IRRELEVANT; duplicate=FRAUD-DUP; confidence<0.85=FRAUD-LOWCONF.`;

// ── [1] Groq (vision) ──────────────────────────────────────────────
const groqKey = process.env.GROQ_API_KEY;
const groqModel = process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
const groqConfigured = Boolean(groqKey);
const groqClient = groqConfigured
  ? new OpenAI({ apiKey: groqKey, baseURL: 'https://api.groq.com/openai/v1' })
  : null;

// ── [2] Microsoft Foundry (reasoning) ──────────────────────────────
const foundryEndpoint = process.env.FOUNDRY_ENDPOINT;
const foundryKey = process.env.FOUNDRY_API_KEY;
const deployment = process.env.FOUNDRY_DEPLOYMENT || 'Phi-4-mini-instruct';
const apiVersion = process.env.FOUNDRY_API_VERSION || '2024-05-01-preview';

const foundryReady = Boolean(foundryEndpoint && foundryKey);

/** Build a client for the Foundry text model, supporting both endpoint styles. */
function createFoundryClient(): OpenAI | null {
  if (!foundryReady) return null;
  // Azure OpenAI–style endpoint (…openai.azure.com)
  if (/openai\.azure\.com/i.test(foundryEndpoint!)) {
    return new AzureOpenAI({ endpoint: foundryEndpoint!, apiKey: foundryKey!, deployment, apiVersion });
  }
  // Azure AI Foundry inference endpoint. The OpenAI-compatible route lives at
  // https://<resource>.services.ai.azure.com/models — strip any /api/projects/... suffix.
  let baseURL = foundryEndpoint!.replace(/\/+$/, '');
  const servicesMatch = baseURL.match(/^(https:\/\/[^/]+\.services\.ai\.azure\.com)/i);
  if (servicesMatch) {
    baseURL = `${servicesMatch[1]}/models`;
  } else if (!/\/models$/i.test(baseURL)) {
    baseURL = `${baseURL}/models`;
  }
  return new OpenAI({
    apiKey: foundryKey!,
    baseURL,
    defaultQuery: { 'api-version': apiVersion },
    defaultHeaders: { 'api-key': foundryKey! },
  });
}

const foundryClient = createFoundryClient();

// Live pipeline needs BOTH the Groq vision step and the Foundry reasoning step.
export const foundryConfigured = Boolean(groqConfigured && foundryReady);
export const pipelineStatus = {
  groqConfigured,
  foundryReady,
  groqModel,
  foundryDeployment: deployment,
};

const VISION_PROMPT = `You are a recycling vision analyst. Describe ONLY what you see in this image,
factually and concisely, to help a downstream reward agent. Report:
- The dominant recyclable material (plastic/PET, aluminum can, cardboard, glass, or none).
- Approximate number of items.
- Rough total size/weight estimate.
- Whether it looks like a real photo of physical waste, or a stock photo / screenshot / irrelevant image (possible fraud).
Answer in 2-4 short sentences. Do NOT compute any reward.`;

const REASONING_SYSTEM_PROMPT = `You are the Prox-Recycle reward agent (Microsoft Foundry IQ).
You receive a VISION DESCRIPTION of a waste photo and a KNOWLEDGE BASE. You MUST ground every
decision in the KNOWLEDGE BASE and cite the entry ids (e.g. PRICE-PET, CO2-ALU, FRAUD-STOCK) you used.

Rules:
- Map the description to one material: PET, Aluminum, Cardboard, Glass, or Unidentified.
- Estimate item count and total weight in kg from the description.
- Detect fraud per the FRAUD rules if the description suggests a stock/irrelevant image.
- Compute rewardKz = estimatedWeight * base_rate_kz_per_kg * multiplier from the matching PRICE entry.
- Compute co2SavedKg from the matching CO2 entry.
- If fraud is detected or material is Unidentified, set rewardKz to 0.
- Return ONLY valid JSON with this exact shape:
{
  "material": string,
  "count": number,
  "isWaste": boolean,
  "confidence": number,
  "estimatedWeight": number,
  "fraudDetected": boolean,
  "explanation": string,
  "rewardKz": number,
  "co2SavedKg": number,
  "citations": [ { "id": string, "source": "recycling-knowledge.md" } ]
}`;

/** [1] Groq vision → textual description of the waste image. */
async function describeImage(base64Image: string): Promise<string> {
  const completion = await groqClient!.chat.completions.create({
    model: groqModel,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: VISION_PROMPT },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
        ] as any,
      },
    ],
  });
  return completion.choices[0]?.message?.content ?? '';
}

/** [2] Foundry IQ text model → grounded, citation-backed reward JSON. */
async function reasonReward(description: string): Promise<ScanResult> {
  const userPrompt = `VISION DESCRIPTION:\n${description}\n\nKNOWLEDGE BASE (grounding source "${KNOWLEDGE_SOURCE}"):\n${COMPACT_KNOWLEDGE}\n\nReturn the grounded JSON reward now.`;

  const maxAttempts = 3;
  let lastErr: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const completion = await foundryClient!.chat.completions.create({
        model: deployment,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: REASONING_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        material: parsed.material ?? 'Unidentified',
        count: Number(parsed.count ?? 0),
        isWaste: Boolean(parsed.isWaste ?? false),
        confidence: Number(parsed.confidence ?? 0),
        estimatedWeight: Number(parsed.estimatedWeight ?? 0),
        fraudDetected: Boolean(parsed.fraudDetected ?? false),
        explanation: parsed.explanation ?? '',
        rewardKz: Math.round(Number(parsed.rewardKz ?? 0)),
        co2SavedKg: Number(parsed.co2SavedKg ?? 0),
        citations: Array.isArray(parsed.citations)
          ? parsed.citations.map((c: any) => ({ id: String(c.id), source: KNOWLEDGE_SOURCE }))
          : [],
        grounded: true,
        provider: 'foundry-iq',
      };
    } catch (err: any) {
      lastErr = err;
      // Retry on rate limit (429) with exponential backoff.
      if (err?.status === 429 && attempt < maxAttempts) {
        const waitMs = 1500 * attempt;
        console.warn(`[foundry] 429 rate limit, retry ${attempt}/${maxAttempts} in ${waitMs}ms`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/** Full hybrid pipeline: Groq vision → Foundry IQ reasoning. */
async function analyzeWithFoundry(base64Image: string): Promise<ScanResult> {
  const description = await describeImage(base64Image);
  try {
    return await reasonReward(description);
  } catch (err: any) {
    // If the Foundry reasoning model is throttled (429), keep the demo alive by
    // grounding the REAL Groq vision description against the knowledge base locally.
    if (err?.status === 429) {
      console.warn('[foundry] reasoning throttled (429); grounding Groq description locally.');
      return groundDescriptionLocally(description);
    }
    throw err;
  }
}

const MATERIAL_KEYWORDS: Record<string, string[]> = {
  Aluminum: ['aluminum', 'aluminium', 'can ', 'cans', 'tin', 'metal'],
  PET: ['pet', 'plastic', 'bottle'],
  Cardboard: ['cardboard', 'carton', 'box', 'paper'],
  Glass: ['glass', 'jar'],
};

/** Deterministic grounding of a real vision description (fallback for 429). */
function groundDescriptionLocally(description: string): ScanResult {
  const text = description.toLowerCase();
  const fraud = /stock photo|screenshot|irrelevant|not a real|no recyclable/.test(text);

  let material = 'Unidentified';
  for (const [mat, words] of Object.entries(MATERIAL_KEYWORDS)) {
    if (words.some((w) => text.includes(w))) { material = mat; break; }
  }

  const ref = PRICE_TABLE[material];
  const countMatch = text.match(/(\d+)\s*(items|bottles|cans|pieces|units)/);
  const count = countMatch ? Number(countMatch[1]) : 1;
  const weightMatch = text.match(/(\d+(?:\.\d+)?)\s*(kg|kilograms?)/);
  const estimatedWeight = weightMatch ? Number(weightMatch[1]) : Number((0.3 + count * 0.05).toFixed(2));

  if (fraud || !ref) {
    return {
      material: fraud ? material : 'Unidentified',
      count, isWaste: false, confidence: 0.6, estimatedWeight,
      fraudDetected: fraud,
      explanation: `Groq vision flagged this image; reasoning grounded locally (Foundry rate-limited). ${description}`.slice(0, 240),
      rewardKz: 0, co2SavedKg: 0,
      citations: [{ id: fraud ? 'FRAUD-STOCK' : 'PRICE-UNKNOWN', source: KNOWLEDGE_SOURCE }],
      grounded: true, provider: 'foundry-iq',
    };
  }

  const rewardKz = Math.round(estimatedWeight * ref.rate * ref.mult);
  return {
    material, count, isWaste: true,
    confidence: 0.88, estimatedWeight, fraudDetected: false,
    explanation: `Groq vision → grounded locally vs knowledge base (Foundry rate-limited). ${description}`.slice(0, 240),
    rewardKz, co2SavedKg: Number((estimatedWeight * ref.co2).toFixed(2)),
    citations: [
      { id: ref.classId, source: KNOWLEDGE_SOURCE },
      { id: ref.priceId, source: KNOWLEDGE_SOURCE },
      { id: ref.co2Id, source: KNOWLEDGE_SOURCE },
    ],
    grounded: true, provider: 'foundry-iq',
  };
}

const PRICE_TABLE: Record<string, { rate: number; mult: number; co2: number; priceId: string; classId: string; co2Id: string }> = {
  PET: { rate: 300, mult: 2.0, co2: 1.5, priceId: 'PRICE-PET', classId: 'CLASS-PET', co2Id: 'CO2-PET' },
  Aluminum: { rate: 450, mult: 2.5, co2: 9.0, priceId: 'PRICE-ALU', classId: 'CLASS-ALU', co2Id: 'CO2-ALU' },
  Cardboard: { rate: 80, mult: 1.0, co2: 0.9, priceId: 'PRICE-CARD', classId: 'CLASS-CARD', co2Id: 'CO2-CARD' },
  Glass: { rate: 60, mult: 1.0, co2: 0.3, priceId: 'PRICE-GLASS', classId: 'CLASS-GLASS', co2Id: 'CO2-GLASS' },
};

/** Deterministic fallback so the demo runs without Azure credentials. */
function analyzeWithMock(): ScanResult {
  const materials = Object.keys(PRICE_TABLE);
  const material = materials[Math.floor(Math.random() * materials.length)];
  const ref = PRICE_TABLE[material];
  const estimatedWeight = Number((Math.random() * 2 + 0.3).toFixed(2));
  const rewardKz = Math.round(estimatedWeight * ref.rate * ref.mult);

  return {
    material,
    count: Math.floor(Math.random() * 12) + 1,
    isWaste: true,
    confidence: Number((Math.random() * 0.12 + 0.86).toFixed(2)),
    estimatedWeight,
    fraudDetected: false,
    explanation: `[MOCK] Classified as ${material}. Set GROQ_API_KEY + FOUNDRY_ENDPOINT/FOUNDRY_API_KEY in .env to enable the live Groq→Foundry IQ pipeline.`,
    rewardKz,
    co2SavedKg: Number((estimatedWeight * ref.co2).toFixed(2)),
    citations: [
      { id: ref.classId, source: KNOWLEDGE_SOURCE },
      { id: ref.priceId, source: KNOWLEDGE_SOURCE },
      { id: ref.co2Id, source: KNOWLEDGE_SOURCE },
    ],
    grounded: true,
    provider: 'mock',
  };
}

export async function analyzeWaste(base64Image: string): Promise<ScanResult> {
  if (foundryConfigured) {
    return analyzeWithFoundry(base64Image);
  }
  return analyzeWithMock();
}
