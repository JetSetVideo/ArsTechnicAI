/**
 * Generation Service
 * 
 * Business logic layer for image generation operations.
 * Separates concerns between API routes and state management.
 * 
 * Architecture Notes:
 * - This service layer is designed to be runtime-agnostic
 * - Will integrate with Python3/PostgreSQL backend when available
 * - Handles validation, transformation, and orchestration
 */

import type { GenerationRequest, GenerationResult, ErrorCode } from '@/types';

// ════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════

export const GENERATION_CONFIG = {
  // Dimension constraints
  MIN_WIDTH: 256,
  MAX_WIDTH: 2048,
  MIN_HEIGHT: 256,
  MAX_HEIGHT: 2048,
  DEFAULT_WIDTH: 1024,
  DEFAULT_HEIGHT: 1024,

  // Prompt constraints
  MIN_PROMPT_LENGTH: 3,
  MAX_PROMPT_LENGTH: 5000,

  // API constraints
  MIN_API_KEY_LENGTH: 10,
  REQUEST_TIMEOUT_MS: 90000,
  PLACEHOLDER_TIMEOUT_MS: 8000,

  // Supported models
  SUPPORTED_MODELS: [
    'imagen-3.0-generate-001',
    'imagen-3.0-fast-generate-001',
  ] as const,

  // Default model
  DEFAULT_MODEL: 'imagen-3.0-generate-001',
} as const;

export type SupportedModel = typeof GENERATION_CONFIG.SUPPORTED_MODELS[number];

// ════════════════════════════════════════════════════════════════════════════
// VALIDATION
// ════════════════════════════════════════════════════════════════════════════

export interface ValidationResult {
  valid: boolean;
  errorCode?: ErrorCode;
  errorMessage?: string;
}

/**
 * Validates a generation request
 */
export function validateGenerationRequest(request: Partial<GenerationRequest>): ValidationResult {
  // Validate prompt
  if (!request.prompt || typeof request.prompt !== 'string') {
    return {
      valid: false,
      errorCode: 'MISSING_PROMPT',
      errorMessage: 'Prompt is required',
    };
  }

  const trimmedPrompt = request.prompt.trim();
  if (trimmedPrompt.length < GENERATION_CONFIG.MIN_PROMPT_LENGTH) {
    return {
      valid: false,
      errorCode: 'INVALID_PROMPT',
      errorMessage: `Prompt must be at least ${GENERATION_CONFIG.MIN_PROMPT_LENGTH} characters`,
    };
  }

  if (trimmedPrompt.length > GENERATION_CONFIG.MAX_PROMPT_LENGTH) {
    return {
      valid: false,
      errorCode: 'PROMPT_TOO_LONG',
      errorMessage: `Prompt must be less than ${GENERATION_CONFIG.MAX_PROMPT_LENGTH} characters`,
    };
  }

  // Validate dimensions
  const width = request.width ?? GENERATION_CONFIG.DEFAULT_WIDTH;
  const height = request.height ?? GENERATION_CONFIG.DEFAULT_HEIGHT;

  if (
    width < GENERATION_CONFIG.MIN_WIDTH ||
    width > GENERATION_CONFIG.MAX_WIDTH ||
    height < GENERATION_CONFIG.MIN_HEIGHT ||
    height > GENERATION_CONFIG.MAX_HEIGHT
  ) {
    return {
      valid: false,
      errorCode: 'INVALID_DIMENSIONS',
      errorMessage: `Dimensions must be between ${GENERATION_CONFIG.MIN_WIDTH}x${GENERATION_CONFIG.MIN_HEIGHT} and ${GENERATION_CONFIG.MAX_WIDTH}x${GENERATION_CONFIG.MAX_HEIGHT}`,
    };
  }

  // Validate model if provided
  if (request.model && !GENERATION_CONFIG.SUPPORTED_MODELS.includes(request.model as SupportedModel)) {
    return {
      valid: false,
      errorCode: 'GENERATION_FAILED',
      errorMessage: `Unsupported model: ${request.model}`,
    };
  }

  return { valid: true };
}

/**
 * Validates an API key format
 */
export function validateApiKey(apiKey: string | undefined): ValidationResult {
  if (!apiKey || typeof apiKey !== 'string') {
    return {
      valid: false,
      errorCode: 'MISSING_API_KEY',
      errorMessage: 'API key is required',
    };
  }

  if (apiKey.trim().length < GENERATION_CONFIG.MIN_API_KEY_LENGTH) {
    return {
      valid: false,
      errorCode: 'INVALID_API_KEY',
      errorMessage: 'API key is too short',
    };
  }

  return { valid: true };
}

// ════════════════════════════════════════════════════════════════════════════
// TRANSFORMATION
// ════════════════════════════════════════════════════════════════════════════

/**
 * Normalizes a generation request with defaults
 */
export function normalizeRequest(request: Partial<GenerationRequest>): GenerationRequest {
  return {
    prompt: request.prompt?.trim() ?? '',
    negativePrompt: request.negativePrompt?.trim(),
    width: request.width ?? GENERATION_CONFIG.DEFAULT_WIDTH,
    height: request.height ?? GENERATION_CONFIG.DEFAULT_HEIGHT,
    model: request.model ?? GENERATION_CONFIG.DEFAULT_MODEL,
    seed: request.seed,
  };
}

/**
 * Sanitizes a prompt for safe logging (removes potential PII)
 */
export function sanitizePromptForLogging(prompt: string, maxLength = 50): string {
  const trimmed = prompt.trim();
  if (trimmed.length <= maxLength) {
    return trimmed + '...';
  }
  return trimmed.substring(0, maxLength) + '...';
}

/**
 * Sanitizes an API key for safe logging
 */
export function sanitizeApiKeyForLogging(apiKey: string): string {
  if (apiKey.length < 10) return '***';
  return apiKey.slice(0, 6) + '...' + apiKey.slice(-4);
}

// ════════════════════════════════════════════════════════════════════════════
// HASH UTILITIES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Generates a deterministic hash from a string (for seeding)
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generates a seed from a prompt for deterministic placeholder generation
 */
export function generateSeedFromPrompt(prompt: string): number {
  return hashString(prompt + Date.now().toString());
}

// ════════════════════════════════════════════════════════════════════════════
// PLACEHOLDER GENERATION
// ════════════════════════════════════════════════════════════════════════════

/**
 * Generates a visual SVG placeholder with deterministic patterns
 */
export function generateVisualPlaceholder(width: number, height: number, seed: number): string {
  // Use seed to generate consistent colors and patterns
  const hue1 = seed % 360;
  const hue2 = (seed * 2) % 360;
  const hue3 = (seed * 3) % 360;

  // Generate gradient colors
  const color1 = `hsl(${hue1}, 70%, 60%)`;
  const color2 = `hsl(${hue2}, 60%, 50%)`;
  const color3 = `hsl(${hue3}, 65%, 55%)`;

  // Generate abstract shapes based on seed
  const shapes: string[] = [];
  const numShapes = 3 + (seed % 5);

  for (let i = 0; i < numShapes; i++) {
    const cx = ((seed * (i + 1) * 17) % width);
    const cy = ((seed * (i + 2) * 23) % height);
    const r = 50 + ((seed * (i + 1)) % 150);
    const opacity = 0.3 + ((seed * i) % 40) / 100;
    const hue = (hue1 + i * 60) % 360;

    shapes.push(`
      <circle
        cx="${cx}"
        cy="${cy}"
        r="${r}"
        fill="hsl(${hue}, 60%, 60%)"
        opacity="${opacity}"
      />
    `);
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="grad-${seed}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
          <stop offset="50%" style="stop-color:${color2};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color3};stop-opacity:1" />
        </linearGradient>
        <filter id="blur-${seed}">
          <feGaussianBlur stdDeviation="40" />
        </filter>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad-${seed})" />
      <g filter="url(#blur-${seed})">
        ${shapes.join('')}
      </g>
      <rect width="100%" height="100%" fill="rgba(255,255,255,0.1)" />
    </svg>
  `.trim().replace(/\s+/g, ' ');
}

/**
 * Converts SVG to data URL
 */
export function svgToDataUrl(svg: string): string {
  // Use base64 encoding for broader compatibility
  const base64 = typeof btoa !== 'undefined' 
    ? btoa(unescape(encodeURIComponent(svg)))
    : Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

// ════════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ════════════════════════════════════════════════════════════════════════════

/**
 * Maps HTTP status codes to error codes
 */
export function mapStatusToErrorCode(status: number, message?: string): ErrorCode {
  const lowerMessage = message?.toLowerCase() ?? '';

  // Check for specific error patterns in message first
  if (lowerMessage.includes('api key') || lowerMessage.includes('unauthorized')) {
    return status === 400 ? 'MISSING_API_KEY' : 'INVALID_API_KEY';
  }

  if (lowerMessage.includes('rate') || lowerMessage.includes('quota') || lowerMessage.includes('limit')) {
    return status === 429 ? 'RATE_LIMITED' : 'QUOTA_EXCEEDED';
  }

  if (lowerMessage.includes('content') || lowerMessage.includes('filter') || lowerMessage.includes('policy')) {
    return 'CONTENT_FILTERED';
  }

  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return 'TIMEOUT';
  }

  // Status-based mapping
  switch (status) {
    case 400:
      return 'GENERATION_FAILED';
    case 401:
    case 403:
      return 'INVALID_API_KEY';
    case 404:
      return 'SERVICE_UNAVAILABLE';
    case 429:
      return 'RATE_LIMITED';
    case 500:
    case 502:
    case 503:
      return 'SERVER_ERROR';
    case 504:
      return 'TIMEOUT';
    default:
      return 'UNKNOWN_ERROR';
  }
}

// ════════════════════════════════════════════════════════════════════════════
// RESULT FORMATTING
// ════════════════════════════════════════════════════════════════════════════

/**
 * Creates a successful generation result
 */
export function createSuccessResult(
  dataUrl: string,
  width: number,
  height: number,
  model: string,
  seed?: number
): GenerationResult {
  return {
    imageUrl: dataUrl,
    width,
    height,
    model,
    seed,
  };
}

/**
 * Creates a filename for a generated image
 */
export function createGeneratedFilename(prompt: string, seed: number): string {
  // Create a short, filesystem-safe name from the prompt
  const safePrompt = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .substring(0, 30)
    .replace(/^-|-$/g, '');
  
  const timestamp = Date.now();
  return `gen-${safePrompt}-${seed}-${timestamp}.png`;
}

// ════════════════════════════════════════════════════════════════════════════
// FUTURE: Backend Integration Points
// ════════════════════════════════════════════════════════════════════════════

/**
 * Placeholder for future backend API integration
 * When Python3/PostgreSQL backend is ready, this will handle:
 * - User authentication
 * - Usage tracking
 * - Rate limiting at application level
 * - Job persistence
 * - Image storage
 */
export interface BackendConfig {
  baseUrl: string;
  apiVersion: string;
  timeout: number;
}

export const DEFAULT_BACKEND_CONFIG: BackendConfig = {
  baseUrl: process.env.BACKEND_URL ?? 'http://localhost:8000',
  apiVersion: 'v1',
  timeout: 30000,
};

/**
 * Future: Submit generation job to backend
 */
export async function submitToBackend(
  _request: GenerationRequest,
  _config: BackendConfig = DEFAULT_BACKEND_CONFIG
): Promise<{ jobId: string }> {
  // TODO: Implement when backend is available
  throw new Error('Backend not yet implemented');
}

/**
 * Future: Check job status from backend
 */
export async function checkJobStatus(
  _jobId: string,
  _config: BackendConfig = DEFAULT_BACKEND_CONFIG
): Promise<{ status: string; result?: GenerationResult }> {
  // TODO: Implement when backend is available
  throw new Error('Backend not yet implemented');
}
