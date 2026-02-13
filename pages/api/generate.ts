import type { NextApiRequest, NextApiResponse } from 'next';

interface GenerateRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  apiKey: string;
  model?: string;
  endpoint?: string;
  /**
   * If true, allow falling back to placeholder images when the upstream
   * provider fails. Defaults to false because placeholder mode can mask
   * configuration/API issues.
   */
  allowPlaceholderFallback?: boolean;
}

interface GenerateResponse {
  imageUrl?: string;
  dataUrl?: string;
  seed?: number;
  modelUsed?: string;
  error?: string;
  errorCode?: string;
}

interface BackendGenerationAttempt {
  result?: GenerateResponse;
  error?: string;
}

// Error codes that map to frontend ERROR_CODES
type APIErrorCode = 
  | 'MISSING_API_KEY'
  | 'INVALID_API_KEY'
  | 'EMPTY_PROMPT'
  | 'PROMPT_TOO_LONG'
  | 'INVALID_DIMENSIONS'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'CONTENT_FILTERED'
  | 'GENERATION_FAILED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'SERVER_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'UNKNOWN_ERROR';

function isBackendGenerationEnabled(): boolean {
  return (
    process.env.BACKEND_GENERATION_ENABLED === 'true' &&
    typeof process.env.BACKEND_URL === 'string' &&
    process.env.BACKEND_URL.trim().length > 0
  );
}

async function attemptBackendGeneration(payload: GenerateRequest): Promise<BackendGenerationAttempt | null> {
  if (!isBackendGenerationEnabled()) {
    return null;
  }

  const backendBase = process.env.BACKEND_URL!.trim();
  const generationPath = process.env.BACKEND_GENERATION_PATH?.trim() || '/api/v1/generate';

  let endpoint: string;
  try {
    endpoint = new URL(generationPath, backendBase.endsWith('/') ? backendBase : `${backendBase}/`).toString();
  } catch {
    return {
      error: 'Invalid BACKEND_URL/BACKEND_GENERATION_PATH configuration.',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const backendApiKey = process.env.BACKEND_API_KEY?.trim();
    if (backendApiKey) {
      headers.Authorization = `Bearer ${backendApiKey}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = `Backend returned HTTP ${response.status}`;
      try {
        const body = await response.json();
        if (typeof body?.error === 'string') {
          message = body.error;
        }
      } catch {
        // Ignore JSON parsing failures for backend error bodies.
      }
      return { error: message };
    }

    const body = (await response.json()) as GenerateResponse;
    if (!body?.dataUrl && !body?.imageUrl) {
      return { error: 'Backend response missing image data.' };
    }

    return { result: body };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { error: 'Backend request timed out.' };
    }
    return { error: 'Could not reach backend service.' };
  } finally {
    clearTimeout(timeoutId);
  }
}

function createError(
  res: NextApiResponse<GenerateResponse>,
  status: number,
  message: string,
  errorCode: APIErrorCode
) {
  console.error(`[API Error] ${errorCode}: ${message}`);
  return res.status(status).json({ error: message, errorCode });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateResponse>
) {
  // ═══════════════════════════════════════════════════════════
  // METHOD VALIDATION
  // ═══════════════════════════════════════════════════════════
  if (req.method !== 'POST') {
    return createError(res, 405, 'Method not allowed', 'UNKNOWN_ERROR');
  }

  const { prompt, negativePrompt, width, height, apiKey, model, endpoint, allowPlaceholderFallback } =
    req.body as GenerateRequest;
  const backendEnabled = isBackendGenerationEnabled();

  // ═══════════════════════════════════════════════════════════
  // INPUT VALIDATION
  // ═══════════════════════════════════════════════════════════
  
  // Validate prompt
  if (!prompt || typeof prompt !== 'string') {
    return createError(res, 400, 'Prompt is required', 'EMPTY_PROMPT');
  }

  const trimmedPrompt = prompt.trim();
  if (trimmedPrompt.length === 0) {
    return createError(res, 400, 'Prompt cannot be empty', 'EMPTY_PROMPT');
  }

  if (trimmedPrompt.length > 4000) {
    return createError(
      res,
      400,
      'Prompt exceeds maximum length of 4000 characters',
      'PROMPT_TOO_LONG'
    );
  }

  // Validate dimensions
  const validWidth = Number(width) || 1024;
  const validHeight = Number(height) || 1024;

  if (validWidth < 256 || validWidth > 2048 || validHeight < 256 || validHeight > 2048) {
    return createError(
      res,
      400,
      'Image dimensions must be between 256 and 2048 pixels',
      'INVALID_DIMENSIONS'
    );
  }

  // ═══════════════════════════════════════════════════════════
  // API REQUEST
  // ═══════════════════════════════════════════════════════════
  
  try {
    // If a local backend is configured (Python + PostgreSQL stack), try it first.
    const backendAttempt = await attemptBackendGeneration({
      prompt,
      negativePrompt,
      width: validWidth,
      height: validHeight,
      apiKey,
      model,
      endpoint,
      allowPlaceholderFallback,
    });

    if (backendAttempt?.result) {
      return res.status(200).json(backendAttempt.result);
    }

    // No backend result: either backend is disabled, or it failed.
    // If backend is enabled and no provider API key is present, we cannot fall back.
    if (backendEnabled && (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10)) {
      return createError(
        res,
        503,
        backendAttempt?.error
          ? `Backend generation failed: ${backendAttempt.error}`
          : 'Backend generation is enabled but unavailable.',
        'SERVICE_UNAVAILABLE'
      );
    }

    if (backendEnabled && backendAttempt?.error) {
      console.warn(`[Generation] Backend failed, falling back to direct provider call: ${backendAttempt.error}`);
    }

    // Validate API key (required for direct provider mode)
    if (!apiKey || typeof apiKey !== 'string') {
      return createError(
        res,
        400,
        'API key is required. Please add your Google Nano Banana API key in Settings.',
        'MISSING_API_KEY'
      );
    }

    if (apiKey.trim().length < 10) {
      return createError(
        res,
        400,
        'API key appears to be invalid. Please check your settings.',
        'INVALID_API_KEY'
      );
    }

    // Google Imagen via Gemini API (API key auth)
    // Docs: https://ai.google.dev/gemini-api/docs/imagen (REST uses x-goog-api-key header)
    const modelName = (typeof model === 'string' && model.trim().length > 0)
      ? model.trim()
      : 'imagen-3.0-generate-002';

    // Basic allowlist validation for model name to avoid path injection
    if (!/^[a-z0-9.\-_]+$/i.test(modelName)) {
      return createError(
        res,
        400,
        'Invalid model name. Please check your Settings → API keys → Model.',
        'GENERATION_FAILED'
      );
    }

    // Endpoint normalization:
    // - Allow either a base endpoint (https://generativelanguage.googleapis.com/v1beta)
    // - Or a full predict URL pasted by the user
    const rawEndpoint = (typeof endpoint === 'string') ? endpoint.trim() : '';

    // Detect Vertex AI endpoints early: they don't work with API-key auth.
    if (rawEndpoint.includes('aiplatform.googleapis.com') || rawEndpoint.match(/-aiplatform\.googleapis\.com/)) {
      return createError(
        res,
        400,
        'This looks like a Vertex AI endpoint. Vertex AI Imagen requires OAuth (gcloud/ADC), not an API key. Use the Gemini endpoint: https://generativelanguage.googleapis.com/v1beta',
        'GENERATION_FAILED'
      );
    }

    const defaultBase = 'https://generativelanguage.googleapis.com/v1beta';
    let apiEndpoint = '';
    let effectiveBase = rawEndpoint || defaultBase;

    // If user pasted a full URL to :predict, use it directly (after safety checks).
    if (effectiveBase.includes('/models/') && effectiveBase.includes(':predict')) {
      try {
        const u = new URL(effectiveBase);
        if (u.origin !== 'https://generativelanguage.googleapis.com') {
          return createError(
            res,
            400,
            'Invalid endpoint host. Please use https://generativelanguage.googleapis.com',
            'GENERATION_FAILED'
          );
        }
        // Strip query params (never accept key via URL query)
        apiEndpoint = `${u.origin}${u.pathname}`;
      } catch {
        return createError(
          res,
          400,
          'Invalid endpoint URL. Use https://generativelanguage.googleapis.com/v1beta (or leave it blank).',
          'GENERATION_FAILED'
        );
      }
    } else {
      // Normalize base endpoint
      effectiveBase = effectiveBase.replace(/\/+$/, '');
      // If they accidentally included /models, remove it
      effectiveBase = effectiveBase.replace(/\/models\/?$/i, '');
      // Ensure v1beta is used for Imagen REST predict
      if (effectiveBase === 'https://generativelanguage.googleapis.com') {
        effectiveBase = defaultBase;
      } else if (effectiveBase === 'https://generativelanguage.googleapis.com/v1') {
        effectiveBase = defaultBase;
      } else if (effectiveBase.startsWith('https://generativelanguage.googleapis.com/') && !effectiveBase.includes('/v1beta')) {
        // If user typed some other path under the domain, prefer v1beta for Imagen
        effectiveBase = defaultBase;
      }

      // Prevent SSRF by restricting custom endpoints to the Gemini API host
      if (!effectiveBase.startsWith('https://generativelanguage.googleapis.com')) {
        return createError(
          res,
          400,
          'Invalid endpoint. Please use the default Gemini API endpoint.',
          'GENERATION_FAILED'
        );
      }

      apiEndpoint = `${effectiveBase}/models/${modelName}:predict`;
    }

    console.log(`[Generation] Provider endpoint: ${apiEndpoint} (model: ${modelName})`);

    // Calculate aspect ratio
    let aspectRatio = '1:1';
    const ratio = validWidth / validHeight;
    if (ratio > 1.2) {
      aspectRatio = '16:9';
    } else if (ratio < 0.8) {
      aspectRatio = '9:16';
    } else if (ratio > 1.1) {
      aspectRatio = '4:3';
    } else if (ratio < 0.9) {
      aspectRatio = '3:4';
    }

    const promptWithNeg = negativePrompt?.trim()
      ? `${trimmedPrompt}\n\nAvoid: ${negativePrompt.trim()}`
      : trimmedPrompt;

    // Gemini Imagen REST parameters (a subset; keep conservative to avoid 400s)
    const requestBody: Record<string, any> = {
      instances: [
        {
          prompt: promptWithNeg,
        },
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio,
      },
    };

    // Optional: request higher resolution on Imagen 4 models when user asks for larger canvas
    const maxDim = Math.max(validWidth, validHeight);
    const isImagen4 = modelName.startsWith('imagen-4.');
    if (isImagen4 && maxDim >= 1536) {
      requestBody.parameters.imageSize = '2K';
    }

    // Set up timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout

    const baseForModels = apiEndpoint.split('/models/')[0];

    async function callProvider(modelToUse: string): Promise<Response> {
      const endpointForModel = `${baseForModels}/models/${modelToUse}:predict`;
      return await fetch(endpointForModel, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Gemini API key auth
          'x-goog-api-key': apiKey.trim(),
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    }

    let response: Response;
    let modelUsed = modelName;
    try {
      response = await callProvider(modelUsed);

      // Methodical fallback: if the model id is wrong or not enabled, try known Imagen variants.
      if (response.status === 404) {
        const fallbacks = [
          'imagen-4.0-generate-001',
          'imagen-4.0-fast-generate-001',
          'imagen-4.0-ultra-generate-001',
          'imagen-3.0-generate-002',
        ].filter((m) => m !== modelUsed);

        for (const candidate of fallbacks) {
          console.log(`[Generation] Model not found (${modelUsed}); trying ${candidate}...`);
          const next = await callProvider(candidate);
          if (next.ok) {
            response = next;
            modelUsed = candidate;
            console.log(`[Generation] Using model: ${modelUsed}`);
            break;
          }
          // If it's not 404, keep the latest response so error handling reports the real issue.
          if (next.status !== 404) {
            response = next;
            modelUsed = candidate;
            break;
          }
        }
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return createError(
          res,
          504,
          'Request timed out. The API took too long to respond.',
          'TIMEOUT'
        );
      }
      
      return createError(
        res,
        503,
        'Unable to connect to the API. Please check your internet connection.',
        'NETWORK_ERROR'
      );
    }

    clearTimeout(timeoutId);

    // ═══════════════════════════════════════════════════════════
    // ERROR RESPONSE HANDLING
    // ═══════════════════════════════════════════════════════════
    
    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
        // Response might not be JSON
      }

      const apiMessage = errorData.error?.message || errorData.message || '';
      const lowerMessage = apiMessage.toLowerCase();

      // Parse specific error types from Google's API
      switch (response.status) {
        case 400:
          // Bad request - could be content filter or invalid params
          if (lowerMessage.includes('safety') || 
              lowerMessage.includes('blocked') || 
              lowerMessage.includes('policy') ||
              lowerMessage.includes('content')) {
            return createError(
              res,
              400,
              'Your prompt was blocked by content safety filters. Please modify your prompt.',
              'CONTENT_FILTERED'
            );
          }
          // Some Gemini API key errors come back as 400
          if (lowerMessage.includes('api key') || lowerMessage.includes('invalid key') || lowerMessage.includes('key not valid')) {
            return createError(
              res,
              401,
              'Invalid API key. Please verify your Gemini API key in Settings.',
              'INVALID_API_KEY'
            );
          }
          // Do not hide config errors by default
          if (allowPlaceholderFallback) {
            console.log('Upstream returned 400; falling back to placeholder mode (explicitly enabled).');
            return await generatePlaceholder(res, validWidth, validHeight, trimmedPrompt);
          }
          return createError(
            res,
            400,
            apiMessage || 'The image provider rejected the request. Please check your model/endpoint settings.',
            'GENERATION_FAILED'
          );

        case 401:
          return createError(
            res,
            401,
            'Invalid API key. Please verify your Google Nano Banana API key.',
            'INVALID_API_KEY'
          );

        case 403:
          if (lowerMessage.includes('quota') || lowerMessage.includes('billing')) {
            return createError(
              res,
              403,
              'API quota exceeded. Please check your Google Cloud billing.',
              'QUOTA_EXCEEDED'
            );
          }
          return createError(
            res,
            403,
            'Access denied. Your API key may not have access to this model.',
            'INVALID_API_KEY'
          );

        case 404:
          if (allowPlaceholderFallback) {
            console.log('Upstream returned 404; falling back to placeholder mode (explicitly enabled).');
            return await generatePlaceholder(res, validWidth, validHeight, trimmedPrompt);
          }
          return createError(
            res,
            404,
            `Model not found. Check Settings → API keys → Model (try imagen-3.0-generate-002 or imagen-4.0-generate-001) and Endpoint (should be https://generativelanguage.googleapis.com/v1beta).`,
            'SERVICE_UNAVAILABLE'
          );

        case 429:
          return createError(
            res,
            429,
            'Too many requests. Please wait a moment before trying again.',
            'RATE_LIMITED'
          );

        case 500:
        case 502:
        case 503:
          return createError(
            res,
            response.status,
            'The API service is temporarily unavailable. Please try again later.',
            'SERVICE_UNAVAILABLE'
          );

        case 504:
          return createError(
            res,
            504,
            'The API request timed out. Please try again.',
            'TIMEOUT'
          );
      }

      // Generic error for other cases
      return createError(
        res,
        response.status,
        apiMessage || 'Failed to generate image. Please try again.',
        'GENERATION_FAILED'
      );
    }

    // ═══════════════════════════════════════════════════════════
    // SUCCESS RESPONSE HANDLING
    // ═══════════════════════════════════════════════════════════
    
    const data = await response.json();

    // Extract the generated image
    if (data.predictions && data.predictions[0]) {
      const prediction = data.predictions[0];
      const imageData = prediction.bytesBase64Encoded;
      
      if (!imageData) {
        return createError(
          res,
          500,
          'API returned empty image data',
          'GENERATION_FAILED'
        );
      }

      const dataUrl = `data:image/png;base64,${imageData}`;

      return res.status(200).json({
        dataUrl,
        seed: Math.floor(Math.random() * 1000000),
        // Helpful for debugging which model actually produced the result
        // (frontend safely ignores unknown fields)
        modelUsed,
      });
    }

    // No predictions returned
    if (allowPlaceholderFallback) {
      console.log('No predictions returned; falling back to placeholder mode (explicitly enabled).');
      return await generatePlaceholder(res, validWidth, validHeight, trimmedPrompt);
    }
    return createError(
      res,
      502,
      'The image provider returned no image data. Please try again, or change model settings.',
      'GENERATION_FAILED'
    );

  } catch (error) {
    console.error('Generation error:', error);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return createError(
          res,
          504,
          'Request timed out. Please try again.',
          'TIMEOUT'
        );
      }
      
      if (error.message.includes('fetch')) {
        return createError(
          res,
          503,
          'Network error. Please check your connection.',
          'NETWORK_ERROR'
        );
      }
    }

    return createError(
      res,
      500,
      'An unexpected error occurred. Please try again.',
      'UNKNOWN_ERROR'
    );
  }
}

// ═══════════════════════════════════════════════════════════
// DEMO PLACEHOLDER - Generates visual placeholder images
// ═══════════════════════════════════════════════════════════

// Generate a visually appealing SVG placeholder that looks like an actual image
function generateVisualPlaceholder(width: number, height: number, seed: number): string {
  // Use seed to generate consistent but varied colors
  const hue1 = (seed * 137) % 360;
  const hue2 = (hue1 + 40) % 360;
  const hue3 = (hue1 + 180) % 360;
  
  // Create gradient colors
  const color1 = `hsl(${hue1}, 70%, 25%)`;
  const color2 = `hsl(${hue2}, 60%, 35%)`;
  const color3 = `hsl(${hue3}, 50%, 20%)`;
  
  // Generate some random shapes based on seed
  const shapes: string[] = [];
  const numShapes = 5 + (seed % 8);
  
  for (let i = 0; i < numShapes; i++) {
    const shapeSeed = seed + i * 1000;
    const x = (shapeSeed * 13) % width;
    const y = (shapeSeed * 17) % height;
    const size = 50 + (shapeSeed % 150);
    const opacity = 0.1 + ((shapeSeed % 30) / 100);
    const shapeHue = (hue1 + (shapeSeed % 60)) % 360;
    
    if (i % 3 === 0) {
      // Circle
      shapes.push(`<circle cx="${x}" cy="${y}" r="${size}" fill="hsl(${shapeHue}, 60%, 40%)" opacity="${opacity}"/>`);
    } else if (i % 3 === 1) {
      // Rectangle
      shapes.push(`<rect x="${x}" y="${y}" width="${size * 1.5}" height="${size}" rx="10" fill="hsl(${shapeHue}, 50%, 35%)" opacity="${opacity}"/>`);
    } else {
      // Ellipse
      shapes.push(`<ellipse cx="${x}" cy="${y}" rx="${size}" ry="${size * 0.6}" fill="hsl(${shapeHue}, 55%, 30%)" opacity="${opacity}"/>`);
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${color1}"/>
        <stop offset="50%" style="stop-color:${color2}"/>
        <stop offset="100%" style="stop-color:${color3}"/>
      </linearGradient>
      <filter id="blur">
        <feGaussianBlur in="SourceGraphic" stdDeviation="30"/>
      </filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <g filter="url(#blur)">
      ${shapes.join('\n      ')}
    </g>
    <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.1)"/>
  </svg>`;

  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

async function generatePlaceholder(
  res: NextApiResponse<GenerateResponse>,
  width: number,
  height: number,
  prompt: string
) {
  const seed = hashPrompt(prompt);
  console.log(`[Placeholder] Generating visual placeholder for: "${prompt.slice(0, 30)}..." (${width}x${height}, seed: ${seed})`);
  
  try {
    // Try external placeholder service first (picsum for real photos)
    const picsumUrl = `https://picsum.photos/seed/${seed}/${width}/${height}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
    
    try {
      const response = await fetch(picsumUrl, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        
        if (buffer.byteLength > 1000) { // Valid image should be > 1KB
          const base64 = Buffer.from(buffer).toString('base64');
          const dataUrl = `data:image/jpeg;base64,${base64}`;

          console.log(`[Placeholder] Successfully fetched from picsum.photos (${buffer.byteLength} bytes)`);
          
          return res.status(200).json({
            imageUrl: picsumUrl,
            dataUrl,
            seed,
          });
        }
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.log('[Placeholder] External service failed, using generated placeholder');
    }

    // Fallback to generated visual placeholder
    const svgDataUrl = generateVisualPlaceholder(width, height, seed);
    console.log(`[Placeholder] Generated visual SVG placeholder`);
    
    return res.status(200).json({
      dataUrl: svgDataUrl,
      seed,
    });
  } catch (error) {
    console.error('[Placeholder] Error:', error);
    
    // Last resort: return a simple colored placeholder
    const fallbackDataUrl = generateVisualPlaceholder(width, height, Date.now());
    
    return res.status(200).json({
      dataUrl: fallbackDataUrl,
      seed: Date.now(),
    });
  }
}

// Simple hash function to generate consistent seed from prompt
function hashPrompt(prompt: string): number {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
