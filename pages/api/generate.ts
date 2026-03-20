import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/options';
import { generateSchema } from '@/lib/validation/schemas';
import { prisma } from '@/lib/prisma';
import { getProvider } from '@/lib/ai/registry';
import type { AIProvider } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

interface GenerateResponse {
  dataUrl?: string;
  imageUrl?: string;
  seed?: number;
  assetId?: string;
  jobId?: string;
  filePath?: string;
  error?: string;
  errorCode?: string;
}

function createError(
  res: NextApiResponse<GenerateResponse>,
  status: number,
  message: string,
  errorCode?: string
) {
  return res.status(status).json({ error: message, errorCode });
}

async function saveGeneratedFile(
  base64Data: string,
  filename: string,
): Promise<string> {
  const generatedDir = path.join(process.cwd(), 'public', 'generated');
  await fs.mkdir(generatedDir, { recursive: true });
  const buffer = Buffer.from(base64Data, 'base64');
  const filePath = path.join(generatedDir, filename);
  await fs.writeFile(filePath, buffer);
  return `/generated/${filename}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return createError(res, 405, 'Method not allowed', 'UNKNOWN_ERROR');
  }

  const session = await getServerSession(req, res, authOptions);

  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
  }

  const {
    prompt,
    negativePrompt,
    width,
    height,
    provider,
    model,
    seed,
    steps,
    guidanceScale,
    projectId,
    apiKey,
  } = parsed.data;

  const resolvedProvider: AIProvider = (provider as AIProvider) || 'GOOGLE_IMAGEN';

  // Require API key (from body) for all generation requests
  if (!apiKey) {
    return res.status(400).json({ error: 'API key required' });
  }

  const providerInstance = getProvider(resolvedProvider);
  if (!providerInstance) {
    return res.status(400).json({ error: `Provider ${resolvedProvider} not available` });
  }

  // Create a pending job record for authenticated users (for tracking)
  let jobId: string | undefined;
  if (session?.user?.id) {
    const job = await prisma.generationJob.create({
      data: {
        userId: session.user.id,
        projectId: projectId ?? null,
        type: 'IMAGE_GENERATION',
        provider: resolvedProvider,
        model,
        prompt,
        negativePrompt,
        width,
        height,
        seed,
        steps,
        guidanceScale,
        status: 'PROCESSING',
      },
    });
    jobId = job.id;
  }

  if (prompt && prompt.trim().length > 4000) {
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
    const result = await providerInstance.generate({
      prompt,
      negativePrompt,
      width,
      height,
      model,
      seed,
      steps,
      guidanceScale,
      apiKey,
    });

    // Save generated image to disk (always) and DB (authenticated users)
    let assetId: string | undefined;
    let filePath: string | undefined;

    try {
      if (result.dataUrl) {
        const base64Data = result.dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const promptSlug = (prompt || 'generated')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .slice(0, 30);
        const filename = `gen_${promptSlug}_${timestamp}.png`;
        filePath = await saveGeneratedFile(base64Data, filename);
      }
    } catch {
      // Storage failure is non-fatal
    }

    if (session?.user?.id) {

      const asset = await prisma.asset.create({
        data: {
          name: `Generated image — ${prompt?.slice(0, 50) ?? 'untitled'}`,
          type: 'IMAGE',
          status: 'READY',
          path: filePath ?? null,
          mimeType: 'image/png',
          width: width ?? null,
          height: height ?? null,
          prompt: prompt ?? null,
          negativePrompt: negativePrompt ?? null,
          model: model ?? null,
          provider: resolvedProvider,
          seed: result.seed ?? null,
          steps: steps ?? null,
          guidanceScale: guidanceScale ?? null,
          userId: session.user.id,
          projectId: projectId ?? null,
        },
      });
      assetId = asset.id;

      // Update the job as completed and link to asset
      if (jobId) {
        await prisma.generationJob.update({
          where: { id: jobId },
          data: {
            status: 'COMPLETED',
            resultAssetId: assetId,
            completedAt: new Date(),
          },
        });
      }
    }

    return res.status(200).json({
      dataUrl: result.dataUrl,
      seed: result.seed,
      assetId,
      jobId,
      filePath,
    });
  } catch (error) {
    // Mark job as failed
    if (jobId) {
      await prisma.generationJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      }).catch(() => {});
    }

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
  res: NextApiResponse,
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
  api: { bodyParser: { sizeLimit: '10mb' } },
};
