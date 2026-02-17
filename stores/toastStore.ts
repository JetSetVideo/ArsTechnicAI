import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number; // ms, undefined = persistent
  action?: {
    label: string;
    onClick: () => void;
  };
  createdAt: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  
  // Convenience methods
  success: (title: string, message: string, duration?: number) => string;
  error: (title: string, message: string, duration?: number) => string;
  warning: (title: string, message: string, duration?: number) => string;
  info: (title: string, message: string, duration?: number) => string;
}

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4000,
  error: 8000, // Errors stay longer
  warning: 6000,
  info: 5000,
};

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (toast) => {
    const id = uuidv4();
    const newToast: Toast = {
      ...toast,
      id,
      createdAt: Date.now(),
      duration: toast.duration ?? DEFAULT_DURATIONS[toast.type],
    };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    if (toast.type === 'error' || toast.type === 'warning') {
      try {
        const { useErrorStore } = require('./errorStore');
        useErrorStore.getState().append({
          code: toast.title,
          message: toast.message,
          context: { type: toast.type },
        });
      } catch {
        // Avoid circular import or runtime errors
      }
    }

    if (newToast.duration) {
      setTimeout(() => {
        get().removeToast(id);
      }, newToast.duration);
    }

    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearToasts: () => {
    set({ toasts: [] });
  },

  // Convenience methods
  success: (title, message, duration) => {
    return get().addToast({ type: 'success', title, message, duration });
  },

  error: (title, message, duration) => {
    return get().addToast({ type: 'error', title, message, duration });
  },

  warning: (title, message, duration) => {
    return get().addToast({ type: 'warning', title, message, duration });
  },

  info: (title, message, duration) => {
    return get().addToast({ type: 'info', title, message, duration });
  },
}));

// Error code mappings for user-friendly messages
export const ERROR_CODES = {
  // API Key errors
  MISSING_API_KEY: {
    title: 'API Key Required',
    message: 'Please add your Google Nano Banana API key in Settings (⌘,)',
  },
  INVALID_API_KEY: {
    title: 'Invalid API Key',
    message: 'Your API key appears to be invalid. Please check your settings.',
  },
  
  // Prompt errors
  EMPTY_PROMPT: {
    title: 'Prompt Required',
    message: 'Please enter a description of the image you want to generate.',
  },
  PROMPT_TOO_LONG: {
    title: 'Prompt Too Long',
    message: 'Your prompt exceeds the maximum length. Please shorten it.',
  },
  
  // Network errors
  NETWORK_ERROR: {
    title: 'Connection Error',
    message: 'Unable to connect to the API. Please check your internet connection.',
  },
  TIMEOUT: {
    title: 'Request Timeout',
    message: 'The request took too long. Please try again.',
  },
  
  // API errors
  RATE_LIMITED: {
    title: 'Rate Limited',
    message: 'Too many requests. Please wait a moment before trying again.',
  },
  QUOTA_EXCEEDED: {
    title: 'Quota Exceeded',
    message: 'You have exceeded your API usage quota. Please check your billing.',
  },
  
  // Generation errors
  CONTENT_FILTERED: {
    title: 'Content Filtered',
    message: 'Your prompt was blocked by content filters. Please modify it.',
  },
  GENERATION_FAILED: {
    title: 'Generation Failed',
    message: 'The image could not be generated. Please try a different prompt.',
  },
  
  // Dimension errors
  INVALID_DIMENSIONS: {
    title: 'Invalid Dimensions',
    message: 'Image dimensions must be between 256 and 2048 pixels.',
  },
  
  // Server errors
  SERVER_ERROR: {
    title: 'Server Error',
    message: 'The API server encountered an error. Please try again later.',
  },
  SERVICE_UNAVAILABLE: {
    title: 'Service Unavailable',
    message: 'The image generation service is temporarily unavailable.',
  },
  
  // Unknown
  UNKNOWN_ERROR: {
    title: 'Unexpected Error',
    message: 'An unexpected error occurred. Please try again.',
  },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

// Helper to parse API errors into error codes
export function parseAPIError(status: number, errorBody?: any): ErrorCode {
  // Check for specific error messages first
  const errorMessage = errorBody?.error?.message?.toLowerCase() || errorBody?.message?.toLowerCase() || '';
  
  if (errorMessage.includes('api key') || errorMessage.includes('apikey') || errorMessage.includes('unauthorized')) {
    return status === 400 ? 'MISSING_API_KEY' : 'INVALID_API_KEY';
  }
  
  if (errorMessage.includes('rate') || errorMessage.includes('limit') || errorMessage.includes('quota')) {
    return status === 429 ? 'RATE_LIMITED' : 'QUOTA_EXCEEDED';
  }
  
  if (errorMessage.includes('content') || errorMessage.includes('filter') || errorMessage.includes('policy')) {
    return 'CONTENT_FILTERED';
  }
  
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return 'TIMEOUT';
  }
  
  // Status-based fallbacks
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
