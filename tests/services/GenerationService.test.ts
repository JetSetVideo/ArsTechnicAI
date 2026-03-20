/**
 * GenerationService Integration Tests
 *
 * Tests for the generateImage orchestrator: validation gating,
 * API call handling, store updates, and error paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateImage } from '../../services/generation/GenerationService';
import { useSettingsStore } from '../../stores/settingsStore';
import { useGenerationStore } from '../../stores/generationStore';
import { useCanvasStore } from '../../stores/canvasStore';
import { useToastStore } from '../../stores/toastStore';
import { useLogStore } from '../../stores/logStore';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function seedSettings(overrides: Record<string, unknown> = {}) {
  const store = useSettingsStore.getState();
  store.updateSettings({
    aiProvider: {
      ...store.settings.aiProvider,
      apiKey: 'AIzaSyB-FAKE-KEY-FOR-TESTING-1234567',
      model: 'imagen-3.0-generate-002',
      provider: 'google',
      ...overrides,
    },
  });
}

describe('GenerationService – generateImage', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    useGenerationStore.getState().reset();
    useCanvasStore.getState().clearAll();
  });

  // ── Validation ─────────────────────────────────────────────

  it('rejects an empty prompt', async () => {
    seedSettings();
    const result = await generateImage({
      prompt: '',
      negativePrompt: '',
      width: 1024,
      height: 1024,
    });
    expect(result.success).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects a prompt that is too short', async () => {
    seedSettings();
    const result = await generateImage({
      prompt: 'ab',
      negativePrompt: '',
      width: 1024,
      height: 1024,
    });
    expect(result.success).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects invalid dimensions', async () => {
    seedSettings();
    const result = await generateImage({
      prompt: 'A beautiful landscape',
      negativePrompt: '',
      width: 100,
      height: 100,
    });
    expect(result.success).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects when API key is missing', async () => {
    const openSettings = vi.fn();
    seedSettings({ apiKey: '' });
    const result = await generateImage({
      prompt: 'A beautiful sunset',
      negativePrompt: '',
      width: 1024,
      height: 1024,
      onMissingApiKey: openSettings,
    });
    expect(result.success).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── Successful generation ──────────────────────────────────

  it('returns success and canvas item on 200', async () => {
    seedSettings();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        dataUrl: 'data:image/png;base64,AAAA',
        seed: 42,
      }),
    });

    const result = await generateImage({
      prompt: 'A beautiful sunset over mountains',
      negativePrompt: '',
      width: 1024,
      height: 1024,
    });

    expect(result.success).toBe(true);
    expect(result.assetId).toBeDefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.prompt).toBe('A beautiful sunset over mountains');
    expect(body.width).toBe(1024);
  });

  // ── API error paths ────────────────────────────────────────

  it('handles 401 unauthorized', async () => {
    seedSettings();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid API key' }),
    });

    const result = await generateImage({
      prompt: 'A beautiful sunset over mountains',
      negativePrompt: '',
      width: 1024,
      height: 1024,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid API key');
  });

  it('handles 429 rate limited', async () => {
    seedSettings();
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'Rate limit exceeded' }),
    });

    const result = await generateImage({
      prompt: 'A beautiful sunset over mountains',
      negativePrompt: '',
      width: 1024,
      height: 1024,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Rate limit');
  });

  it('handles network error (fetch throws)', async () => {
    seedSettings();
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const result = await generateImage({
      prompt: 'A beautiful sunset over mountains',
      negativePrompt: '',
      width: 1024,
      height: 1024,
    });

    expect(result.success).toBe(false);
  });

  it('handles response with no image data', async () => {
    seedSettings();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const result = await generateImage({
      prompt: 'A beautiful sunset over mountains',
      negativePrompt: '',
      width: 1024,
      height: 1024,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('No image');
  });

  // ── Toast / log side effects ───────────────────────────────

  it('shows info toast on start and success toast on completion', async () => {
    seedSettings();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        dataUrl: 'data:image/png;base64,BBBB',
        seed: 99,
      }),
    });

    const toastSpy = vi.spyOn(useToastStore.getState(), 'success');
    await generateImage({
      prompt: 'A beautiful sunset over mountains',
      negativePrompt: '',
      width: 1024,
      height: 1024,
    });
    expect(toastSpy).toHaveBeenCalled();
  });

  it('logs generation_start and generation_complete', async () => {
    seedSettings();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        dataUrl: 'data:image/png;base64,CCCC',
        seed: 7,
      }),
    });

    const logSpy = vi.spyOn(useLogStore.getState(), 'log');
    await generateImage({
      prompt: 'A beautiful sunset over mountains',
      negativePrompt: '',
      width: 1024,
      height: 1024,
    });

    const logCalls = logSpy.mock.calls.map((c) => c[0]);
    expect(logCalls).toContain('generation_start');
    expect(logCalls).toContain('generation_complete');
  });
});
