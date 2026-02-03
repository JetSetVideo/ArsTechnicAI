/**
 * Toast Store Unit Tests
 * 
 * Tests for toast notification management including:
 * - Adding/removing toasts
 * - Toast types (success, error, warning, info)
 * - Error code parsing
 * - Auto-dismiss functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'mock-toast-' + Math.random().toString(36).substr(2, 9),
}));

import { useToastStore, ERROR_CODES, parseAPIError } from '../../stores/toastStore';

describe('ToastStore', () => {
  beforeEach(() => {
    // Clear all toasts
    useToastStore.getState().clearToasts();
    vi.clearAllTimers();
  });

  describe('Toast Operations', () => {
    it('should add a toast', () => {
      const store = useToastStore.getState();
      
      store.addToast({
        type: 'info',
        title: 'Test Toast',
        message: 'This is a test',
      });
      
      const state = useToastStore.getState();
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].title).toBe('Test Toast');
      expect(state.toasts[0].type).toBe('info');
    });

    it('should remove a toast by id', () => {
      const store = useToastStore.getState();
      
      store.addToast({ type: 'info', title: 'Test', message: 'Message' });
      const toastId = useToastStore.getState().toasts[0].id;
      
      store.removeToast(toastId);
      
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it('should clear all toasts', () => {
      const store = useToastStore.getState();
      
      store.addToast({ type: 'info', title: 'Toast 1', message: 'Message 1' });
      store.addToast({ type: 'error', title: 'Toast 2', message: 'Message 2' });
      store.addToast({ type: 'success', title: 'Toast 3', message: 'Message 3' });
      
      expect(useToastStore.getState().toasts).toHaveLength(3);
      
      store.clearToasts();
      
      expect(useToastStore.getState().toasts).toHaveLength(0);
    });
  });

  describe('Toast Type Helpers', () => {
    it('should add success toast', () => {
      const store = useToastStore.getState();
      
      store.success('Operation Successful', 'The operation completed.');
      
      const state = useToastStore.getState();
      expect(state.toasts[0].type).toBe('success');
      expect(state.toasts[0].title).toBe('Operation Successful');
    });

    it('should add error toast', () => {
      const store = useToastStore.getState();
      
      store.error('Error Occurred', 'Something went wrong.');
      
      const state = useToastStore.getState();
      expect(state.toasts[0].type).toBe('error');
      expect(state.toasts[0].title).toBe('Error Occurred');
    });

    it('should add warning toast', () => {
      const store = useToastStore.getState();
      
      store.warning('Warning', 'Please be careful.');
      
      const state = useToastStore.getState();
      expect(state.toasts[0].type).toBe('warning');
    });

    it('should add info toast', () => {
      const store = useToastStore.getState();
      
      store.info('Information', 'Here is some info.');
      
      const state = useToastStore.getState();
      expect(state.toasts[0].type).toBe('info');
    });
  });

  describe('Toast with Actions', () => {
    it('should add toast with action callback', () => {
      const store = useToastStore.getState();
      const mockAction = vi.fn();
      
      store.addToast({
        type: 'error',
        title: 'Error',
        message: 'Click to fix',
        action: {
          label: 'Fix It',
          onClick: mockAction,
        },
      });
      
      const state = useToastStore.getState();
      expect(state.toasts[0].action).toBeDefined();
      expect(state.toasts[0].action?.label).toBe('Fix It');
      
      // Trigger the action
      state.toasts[0].action?.onClick();
      expect(mockAction).toHaveBeenCalled();
    });
  });

  describe('Toast Duration', () => {
    it('should have default duration based on type', () => {
      const store = useToastStore.getState();
      
      store.addToast({ type: 'success', title: 'Success', message: 'Done' });
      store.addToast({ type: 'error', title: 'Error', message: 'Failed' });
      
      const state = useToastStore.getState();
      // Success should have shorter duration than error
      expect(state.toasts.find(t => t.type === 'success')?.duration).toBeLessThan(
        state.toasts.find(t => t.type === 'error')?.duration ?? 0
      );
    });

    it('should allow custom duration', () => {
      const store = useToastStore.getState();
      
      store.addToast({
        type: 'info',
        title: 'Custom',
        message: 'Custom duration',
        duration: 10000,
      });
      
      const state = useToastStore.getState();
      expect(state.toasts[0].duration).toBe(10000);
    });
  });
});

describe('ERROR_CODES', () => {
  it('should have all required error codes', () => {
    const requiredCodes = [
      'MISSING_API_KEY',
      'INVALID_API_KEY',
      'EMPTY_PROMPT',
      'PROMPT_TOO_LONG',
      'INVALID_DIMENSIONS',
      'GENERATION_FAILED',
      'NETWORK_ERROR',
      'TIMEOUT',
      'RATE_LIMITED',
      'CONTENT_FILTERED',
      'SERVER_ERROR',
    ];
    
    for (const code of requiredCodes) {
      expect(ERROR_CODES[code as keyof typeof ERROR_CODES]).toBeDefined();
      expect(ERROR_CODES[code as keyof typeof ERROR_CODES].title).toBeDefined();
      expect(ERROR_CODES[code as keyof typeof ERROR_CODES].message).toBeDefined();
    }
  });

  it('should have descriptive error messages', () => {
    expect(ERROR_CODES.MISSING_API_KEY.title).toContain('API');
    expect(ERROR_CODES.EMPTY_PROMPT.title).toContain('Prompt');
    expect(ERROR_CODES.RATE_LIMITED.title).toContain('Rate');
  });
});

describe('parseAPIError', () => {
  it('should parse 401 as INVALID_API_KEY', () => {
    const result = parseAPIError(401, 'Unauthorized');
    expect(result).toBe('INVALID_API_KEY');
  });

  it('should parse 403 as INVALID_API_KEY', () => {
    const result = parseAPIError(403, 'Forbidden');
    expect(result).toBe('INVALID_API_KEY');
  });

  it('should parse 429 as RATE_LIMITED', () => {
    const result = parseAPIError(429, 'Too Many Requests');
    expect(result).toBe('RATE_LIMITED');
  });

  it('should parse 500 as SERVER_ERROR', () => {
    const result = parseAPIError(500, 'Internal Server Error');
    expect(result).toBe('SERVER_ERROR');
  });

  it('should parse content filter errors from message', () => {
    // The parseAPIError looks for 'content', 'filter', or 'policy' in the message
    const result = parseAPIError(400, { error: { message: 'Content was blocked by safety filters' } });
    expect(result).toBe('CONTENT_FILTERED');
  });

  it('should parse 504 as TIMEOUT', () => {
    const result = parseAPIError(504, 'Gateway Timeout');
    expect(result).toBe('TIMEOUT');
  });

  it('should parse timeout from message', () => {
    const result = parseAPIError(400, { message: 'Request timed out' });
    expect(result).toBe('TIMEOUT');
  });

  it('should return UNKNOWN_ERROR for truly unknown status codes', () => {
    const result = parseAPIError(418, "I'm a teapot");
    expect(result).toBe('UNKNOWN_ERROR');
  });

  it('should parse 400 as GENERATION_FAILED by default', () => {
    const result = parseAPIError(400, 'Bad request');
    expect(result).toBe('GENERATION_FAILED');
  });

  it('should detect API key errors from message', () => {
    const result = parseAPIError(400, { message: 'Invalid API key provided' });
    expect(result).toBe('MISSING_API_KEY');
  });

  it('should detect rate/quota from message (non-429 status)', () => {
    // Per implementation: rate/limit/quota keywords with non-429 status => QUOTA_EXCEEDED
    const result = parseAPIError(400, { error: { message: 'Rate limit exceeded' } });
    expect(result).toBe('QUOTA_EXCEEDED');
  });

  it('should return RATE_LIMITED for 429 with rate/limit message', () => {
    const result = parseAPIError(429, { error: { message: 'Rate limit exceeded' } });
    expect(result).toBe('RATE_LIMITED');
  });
});
