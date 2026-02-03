/**
 * Generation Service Unit Tests
 * 
 * Tests for the generation service business logic including:
 * - Validation functions
 * - Transformation utilities
 * - Placeholder generation
 * - Error mapping
 */

import { describe, it, expect } from 'vitest';
import {
  GENERATION_CONFIG,
  validateGenerationRequest,
  validateApiKey,
  normalizeRequest,
  sanitizePromptForLogging,
  sanitizeApiKeyForLogging,
  hashString,
  generateSeedFromPrompt,
  generateVisualPlaceholder,
  svgToDataUrl,
  mapStatusToErrorCode,
  createSuccessResult,
  createGeneratedFilename,
} from '../../services/generation';

describe('GenerationService', () => {
  describe('GENERATION_CONFIG', () => {
    it('should have valid dimension constraints', () => {
      expect(GENERATION_CONFIG.MIN_WIDTH).toBe(256);
      expect(GENERATION_CONFIG.MAX_WIDTH).toBe(2048);
      expect(GENERATION_CONFIG.MIN_HEIGHT).toBe(256);
      expect(GENERATION_CONFIG.MAX_HEIGHT).toBe(2048);
    });

    it('should have valid default values', () => {
      expect(GENERATION_CONFIG.DEFAULT_WIDTH).toBe(1024);
      expect(GENERATION_CONFIG.DEFAULT_HEIGHT).toBe(1024);
      expect(GENERATION_CONFIG.DEFAULT_MODEL).toBe('imagen-3.0-generate-001');
    });

    it('should have supported models', () => {
      expect(GENERATION_CONFIG.SUPPORTED_MODELS.length).toBeGreaterThan(0);
      expect(GENERATION_CONFIG.SUPPORTED_MODELS).toContain('imagen-3.0-generate-001');
    });
  });

  describe('validateGenerationRequest', () => {
    it('should accept valid request', () => {
      const result = validateGenerationRequest({
        prompt: 'A beautiful sunset over mountains',
        width: 1024,
        height: 1024,
      });
      expect(result.valid).toBe(true);
    });

    it('should reject missing prompt', () => {
      const result = validateGenerationRequest({});
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MISSING_PROMPT');
    });

    it('should reject empty prompt', () => {
      const result = validateGenerationRequest({ prompt: '' });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MISSING_PROMPT');
    });

    it('should reject short prompt', () => {
      const result = validateGenerationRequest({ prompt: 'ab' });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_PROMPT');
    });

    it('should reject long prompt', () => {
      const result = validateGenerationRequest({
        prompt: 'a'.repeat(GENERATION_CONFIG.MAX_PROMPT_LENGTH + 1),
      });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('PROMPT_TOO_LONG');
    });

    it('should reject invalid dimensions', () => {
      const result = validateGenerationRequest({
        prompt: 'Valid prompt',
        width: 100,
        height: 100,
      });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_DIMENSIONS');
    });

    it('should reject unsupported model', () => {
      const result = validateGenerationRequest({
        prompt: 'Valid prompt',
        model: 'unsupported-model',
      });
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('GENERATION_FAILED');
    });

    it('should accept request with defaults', () => {
      const result = validateGenerationRequest({
        prompt: 'A valid prompt for testing',
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('validateApiKey', () => {
    it('should accept valid API key', () => {
      const result = validateApiKey('AIzaSyB-1234567890abcdefghijklmnop');
      expect(result.valid).toBe(true);
    });

    it('should reject missing API key', () => {
      const result = validateApiKey(undefined);
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MISSING_API_KEY');
    });

    it('should reject empty API key', () => {
      const result = validateApiKey('');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('MISSING_API_KEY');
    });

    it('should reject short API key', () => {
      const result = validateApiKey('short');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_API_KEY');
    });
  });

  describe('normalizeRequest', () => {
    it('should apply defaults for missing values', () => {
      const result = normalizeRequest({ prompt: 'Test prompt' });
      
      expect(result.prompt).toBe('Test prompt');
      expect(result.width).toBe(GENERATION_CONFIG.DEFAULT_WIDTH);
      expect(result.height).toBe(GENERATION_CONFIG.DEFAULT_HEIGHT);
      expect(result.model).toBe(GENERATION_CONFIG.DEFAULT_MODEL);
    });

    it('should trim prompt', () => {
      const result = normalizeRequest({ prompt: '  Test prompt  ' });
      expect(result.prompt).toBe('Test prompt');
    });

    it('should preserve provided values', () => {
      const result = normalizeRequest({
        prompt: 'Test',
        width: 512,
        height: 768,
        model: 'imagen-3.0-fast-generate-001',
      });
      
      expect(result.width).toBe(512);
      expect(result.height).toBe(768);
      expect(result.model).toBe('imagen-3.0-fast-generate-001');
    });
  });

  describe('sanitizePromptForLogging', () => {
    it('should truncate long prompts', () => {
      const longPrompt = 'A'.repeat(100);
      const result = sanitizePromptForLogging(longPrompt, 50);
      
      expect(result.length).toBeLessThan(longPrompt.length);
      expect(result.endsWith('...')).toBe(true);
    });

    it('should add ellipsis to short prompts', () => {
      const result = sanitizePromptForLogging('Short', 50);
      expect(result).toBe('Short...');
    });
  });

  describe('sanitizeApiKeyForLogging', () => {
    it('should mask middle of API key', () => {
      const result = sanitizeApiKeyForLogging('AIzaSyB-1234567890abcdefghij');
      
      expect(result).not.toContain('1234567890');
      expect(result).toContain('...');
      expect(result.startsWith('AIzaSy')).toBe(true);
    });

    it('should return *** for very short keys', () => {
      const result = sanitizeApiKeyForLogging('short');
      expect(result).toBe('***');
    });
  });

  describe('hashString', () => {
    it('should return deterministic hash', () => {
      const hash1 = hashString('test string');
      const hash2 = hashString('test string');
      
      expect(hash1).toBe(hash2);
    });

    it('should return different hash for different strings', () => {
      const hash1 = hashString('string one');
      const hash2 = hashString('string two');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should return positive number', () => {
      const hash = hashString('test');
      expect(hash).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generateSeedFromPrompt', () => {
    it('should return a number', () => {
      const seed = generateSeedFromPrompt('A beautiful sunset');
      expect(typeof seed).toBe('number');
    });

    it('should return positive number', () => {
      const seed = generateSeedFromPrompt('Test prompt');
      expect(seed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generateVisualPlaceholder', () => {
    it('should return valid SVG string', () => {
      const svg = generateVisualPlaceholder(512, 512, 12345);
      
      expect(svg).toContain('<svg');
      expect(svg).toContain('width="512"');
      expect(svg).toContain('height="512"');
      expect(svg).toContain('</svg>');
    });

    it('should include gradient and shapes', () => {
      const svg = generateVisualPlaceholder(512, 512, 12345);
      
      expect(svg).toContain('linearGradient');
      expect(svg).toContain('circle');
    });

    it('should produce different results for different seeds', () => {
      const svg1 = generateVisualPlaceholder(512, 512, 111);
      const svg2 = generateVisualPlaceholder(512, 512, 222);
      
      expect(svg1).not.toBe(svg2);
    });
  });

  describe('svgToDataUrl', () => {
    it('should return data URL', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>';
      const dataUrl = svgToDataUrl(svg);
      
      expect(dataUrl).toMatch(/^data:image\/svg\+xml;base64,/);
    });
  });

  describe('mapStatusToErrorCode', () => {
    it('should map 401 to INVALID_API_KEY', () => {
      expect(mapStatusToErrorCode(401)).toBe('INVALID_API_KEY');
    });

    it('should map 403 to INVALID_API_KEY', () => {
      expect(mapStatusToErrorCode(403)).toBe('INVALID_API_KEY');
    });

    it('should map 429 to RATE_LIMITED', () => {
      expect(mapStatusToErrorCode(429)).toBe('RATE_LIMITED');
    });

    it('should map 500 to SERVER_ERROR', () => {
      expect(mapStatusToErrorCode(500)).toBe('SERVER_ERROR');
    });

    it('should map 504 to TIMEOUT', () => {
      expect(mapStatusToErrorCode(504)).toBe('TIMEOUT');
    });

    it('should detect content filter from message', () => {
      expect(mapStatusToErrorCode(400, 'Content was filtered')).toBe('CONTENT_FILTERED');
    });

    it('should detect API key errors from message', () => {
      expect(mapStatusToErrorCode(400, 'Invalid API key')).toBe('MISSING_API_KEY');
    });

    it('should return UNKNOWN_ERROR for unhandled status', () => {
      expect(mapStatusToErrorCode(418)).toBe('UNKNOWN_ERROR');
    });
  });

  describe('createSuccessResult', () => {
    it('should create result with all fields', () => {
      const result = createSuccessResult(
        'data:image/png;base64,test',
        1024,
        1024,
        'imagen-3.0-generate-001',
        12345
      );
      
      expect(result.imageUrl).toBe('data:image/png;base64,test');
      expect(result.width).toBe(1024);
      expect(result.height).toBe(1024);
      expect(result.model).toBe('imagen-3.0-generate-001');
      expect(result.seed).toBe(12345);
    });
  });

  describe('createGeneratedFilename', () => {
    it('should create filesystem-safe filename', () => {
      const filename = createGeneratedFilename('A Beautiful Sunset!', 12345);
      
      expect(filename).toMatch(/^gen-[a-z0-9-]+-\d+-\d+\.png$/);
      expect(filename).not.toContain('!');
      expect(filename).not.toContain(' ');
    });

    it('should truncate long prompts', () => {
      const longPrompt = 'A'.repeat(100);
      const filename = createGeneratedFilename(longPrompt, 12345);
      
      // Should be reasonably short
      expect(filename.length).toBeLessThan(80);
    });

    it('should handle empty prompt', () => {
      const filename = createGeneratedFilename('', 12345);
      
      expect(filename).toMatch(/^gen-.*\.png$/);
    });
  });
});
