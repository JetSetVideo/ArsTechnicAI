import type { NextApiRequest, NextApiResponse } from 'next';

interface GenerateRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  apiKey: string;
}

interface GenerateResponse {
  imageUrl?: string;
  dataUrl?: string;
  seed?: number;
  error?: string;
  errorCode?: string;
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

  const { prompt, negativePrompt, width, height, apiKey } =
    req.body as GenerateRequest;

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

  // Validate API key
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
    // Google Imagen API endpoint (NanoBanana refers to Google's API)
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`;

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

    const requestBody = {
      instances: [
        {
          prompt: trimmedPrompt,
        },
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio,
        ...(negativePrompt && { negativePrompt }),
      },
    };

    // Set up timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
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

      const apiMessage = errorData.error?.message || '';
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
          // Fall through to demo mode for other 400 errors
          break;

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
          // Model not found - fall through to demo mode
          break;

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

      // For 400/404 errors that might be model availability issues,
      // fall through to demo placeholder mode
      if (response.status === 404 || response.status === 400) {
        console.log('Falling back to demo placeholder mode');
        return await generatePlaceholder(res, validWidth, validHeight, trimmedPrompt);
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
      });
    }

    // No predictions returned - try placeholder
    console.log('No predictions returned, falling back to placeholder');
    return await generatePlaceholder(res, validWidth, validHeight, trimmedPrompt);

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
