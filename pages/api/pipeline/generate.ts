import type { NextApiRequest, NextApiResponse } from 'next';

// ─────────────────────────────────────────────────────────────────────────────
// Workshop pipeline generation — Google "banana2" (Gemini image) + Gemini text.
// Uses the user's own Google API key. Other model providers plug in later.
// ─────────────────────────────────────────────────────────────────────────────

export const config = {
  api: { bodyParser: { sizeLimit: '25mb' } },
};

const GL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// banana2 = Nano Banana 2 (Gemini image). Try newest first, fall back.
const IMAGE_MODELS = [
  'gemini-3-pro-image-preview',
  'gemini-2.5-flash-image',
  'gemini-2.0-flash-preview-image-generation',
];
const TEXT_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'];

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  let lastError = 'No model available';
  for (const candidate of [...new Set(candidates)]) {
    try {
      let result = await callGemini(candidate, apiKey, body);

      // Some models reject imageConfig — retry once without it
      if (!result.ok && result.status === 400 && isImage && aspectRatio) {
        const { imageConfig: _drop, ...cfg } = (body.generationConfig ?? {}) as Record<string, unknown>;
        result = await callGemini(candidate, apiKey, { ...body, generationConfig: cfg });
      }

      if (result.ok) {
        const { text, dataUrl } = extractParts(result.json);
        if (isImage && !dataUrl) {
          lastError = text
            ? `Model returned no image: ${text.slice(0, 300)}`
            : 'Model returned no image';
          continue;
        }
        return res.status(200).json({ text, dataUrl, model: candidate });
      }

      lastError = result.json?.error?.message || `HTTP ${result.status}`;
      // Model not found / no access → try next candidate; other errors are fatal
      if (result.status !== 404 && result.status !== 403 && result.status !== 400) {
        return res.status(result.status).json({ error: lastError, model: candidate });
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return res.status(502).json({ error: `banana2 generation failed: ${lastError}` });
}
