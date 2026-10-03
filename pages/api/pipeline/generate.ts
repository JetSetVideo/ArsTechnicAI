import { withPrincipal } from '@/lib/auth/requestAuth';
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  BANANA_IMAGE_MODELS,
  BANANA_TEXT_MODELS,
  isUnavailableModelError,
  rankDiscoveredImageModels,
  rankDiscoveredTextModels,
} from '@/lib/pipeline/bananaModels';

// Workshop pipeline generation — Nano Banana 2 (Gemini image) + Gemini text.
// Uses the user's own Google API key. Other model providers plug in later.

export const config = {
  api: { bodyParser: { sizeLimit: '25mb' } },
};

const GL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const IMAGE_MODELS: readonly string[] = BANANA_IMAGE_MODELS;
const TEXT_MODELS: readonly string[] = BANANA_TEXT_MODELS;

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  inline_data?: { mime_type: string; data: string };
}

function dataUrlToPart(dataUrl: string): GeminiPart | null {
  const match = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { inline_data: { mime_type: match[1], data: match[2] } };
}

async function callGemini(
  model: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; json: any }> {
  const resp = await fetch(`${GL_BASE}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, json };
}

async function discoverModelIds(apiKey: string): Promise<string[]> {
  const found: string[] = [];
  let pageToken = '';
  for (let page = 0; page < 3; page += 1) {
    const url = new URL(GL_BASE);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const resp = await fetch(url);
    if (!resp.ok) break;
    const json = await resp.json().catch(() => ({}));
    for (const model of json.models ?? []) {
      const methods: string[] = model.supportedGenerationMethods ?? [];
      if (!methods.includes('generateContent')) continue;
      const id = String(model.name ?? '').replace(/^models\//, '');
      if (id) found.push(id);
    }
    pageToken = typeof json.nextPageToken === 'string' ? json.nextPageToken : '';
    if (!pageToken) break;
  }
  return found;
}

function extractParts(json: any): { text?: string; dataUrl?: string } {
  const parts: GeminiPart[] = json?.candidates?.[0]?.content?.parts ?? [];
  let text: string | undefined;
  let dataUrl: string | undefined;
  for (const part of parts) {
    if (part.text) text = (text ? text + '\n' : '') + part.text;
    const inline = part.inlineData ?? part.inline_data;
    if (inline && !dataUrl) {
      const mime = (inline as any).mimeType ?? (inline as any).mime_type ?? 'image/png';
      dataUrl = `data:${mime};base64,${inline.data}`;
    }
  }
  return { text, dataUrl };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { kind, prompt, system, images, aspectRatio, model, temperature, apiKey } =
    (req.body ?? {}) as {
      kind?: string; prompt?: string; system?: string; images?: string[];
      aspectRatio?: string; model?: string; temperature?: number; apiKey?: string;
    };

  if (!kind || !['text', 'image', 'image-edit'].includes(kind)) {
    return res.status(400).json({ error: 'kind must be text | image | image-edit' });
  }
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  if (prompt.length > 30000) {
    return res.status(400).json({ error: 'prompt too long (max 30000 chars)' });
  }
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({
      error: 'Google API key required — add it in Settings → AI Provider (used for banana2 image + Gemini text).',
    });
  }

  const parts: GeminiPart[] = [];
  const refImages = Array.isArray(images) ? images.slice(0, 6) : [];
  for (const img of refImages) {
    if (typeof img !== 'string') continue;
    const part = dataUrlToPart(img);
    if (part) parts.push(part);
  }
  parts.push({ text: prompt.trim() });

  const isImage = kind === 'image' || kind === 'image-edit';
  const candidates = model
    ? [model, ...(isImage ? IMAGE_MODELS : TEXT_MODELS)]
    : isImage ? IMAGE_MODELS : TEXT_MODELS;

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      ...(isImage ? { responseModalities: ['TEXT', 'IMAGE'] } : {}),
      ...(typeof temperature === 'number' ? { temperature: Math.max(0, Math.min(2, temperature)) } : {}),
      ...(isImage && aspectRatio ? { imageConfig: { aspectRatio } } : {}),
    },
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
  };

  const tried: string[] = [];
  let lastError = 'No image model is available for this key';

  const attempt = async (candidate: string): Promise<{ done: true; payload: unknown } | { done: false; fatal?: { status: number; error: string } }> => {
    tried.push(candidate);
    let result = await callGemini(candidate, apiKey, body);

    if (!result.ok && result.status === 400) {
      const cfg = { ...((body.generationConfig ?? {}) as Record<string, unknown>) };
      delete cfg.imageConfig;
      delete cfg.temperature;
      result = await callGemini(candidate, apiKey, { ...body, generationConfig: cfg });
    }

    if (result.ok) {
      const { text, dataUrl } = extractParts(result.json);
      if (isImage && !dataUrl) {
        lastError = text
          ? `${candidate} returned no image: ${text.slice(0, 180)}`
          : `${candidate} returned no image`;
        return { done: false };
      }
      return { done: true, payload: { text, dataUrl, model: candidate } };
    }

    const message = result.json?.error?.message || `HTTP ${result.status}`;
    lastError = message;
    const lower = message.toLowerCase();
    if (result.status === 401 || lower.includes('api key') || lower.includes('permission denied')) {
      return { done: false, fatal: { status: result.status === 401 ? 401 : 403, error: message } };
    }
    if (result.status === 429 || lower.includes('quota') || lower.includes('rate limit')) {
      return { done: false, fatal: { status: 429, error: message } };
    }
    if (isUnavailableModelError(result.status, message) || result.status === 400 || result.status === 403) {
      return { done: false };
    }
    return { done: false, fatal: { status: result.status, error: message } };
  };

  for (const candidate of [...new Set(candidates)]) {
    try {
      const outcome = await attempt(candidate);
      if (outcome.done) return res.status(200).json(outcome.payload);
      if (outcome.fatal) return res.status(outcome.fatal.status).json({ error: outcome.fatal.error, model: candidate });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  try {
    const listed = await discoverModelIds(apiKey);
    const discovered = isImage
      ? rankDiscoveredImageModels(listed, tried)
      : rankDiscoveredTextModels(listed, tried);
    for (const candidate of discovered.slice(0, 4)) {
      const outcome = await attempt(candidate);
      if (outcome.done) return res.status(200).json(outcome.payload);
      if (outcome.fatal) return res.status(outcome.fatal.status).json({ error: outcome.fatal.error, model: candidate });
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
  }

  const names = tried.filter((name, index) => tried.indexOf(name) === index).slice(0, 4).join(', ');
  const kindLabel = isImage ? 'Nano Banana 2' : 'Gemini 3.8 Flash';
  return res.status(502).json({
    error: names
      ? `Model unavailable (${names}). Use a Google AI Studio key that can call ${kindLabel}.`
      : lastError,
  });
}

// Owner over trusted loopback, or a signed-in user (lib/auth/requestAuth).
export default withPrincipal(handler, { allowLocal: true });
