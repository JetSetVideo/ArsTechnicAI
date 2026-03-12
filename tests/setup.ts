/**
 * Vitest Test Setup
 * 
 * This file configures the test environment for ArsTechnicAI.
 * It sets up mocks for browser APIs and provides test utilities.
 */

import { vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

// Mock window properties for userStore
Object.defineProperty(global, 'window', {
  value: {
    screen: {
      width: 1920,
      height: 1080,
      colorDepth: 24,
    },
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1,
    navigator: {
      platform: 'Linux x86_64',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
      language: 'en-US',
      languages: ['en-US', 'en'],
      hardwareConcurrency: 8,
      maxTouchPoints: 0,
      deviceMemory: 8,
      connection: {
        type: 'wifi',
        effectiveType: '4g',
      },
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  writable: true,
});

// Mock navigator
Object.defineProperty(global, 'navigator', {
  value: global.window.navigator,
  writable: true,
});

// Mock Intl.DateTimeFormat
const mockDateTimeFormat = {
  resolvedOptions: () => ({ timeZone: 'America/New_York' }),
};
vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => mockDateTimeFormat as Intl.DateTimeFormat);

// Reset stores before each test
beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

// Cleanup after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// Test utilities
export const createMockAsset = (overrides = {}) => ({
  id: 'test-asset-id',
  name: 'test-asset.png',
  type: 'image' as const,
  path: '/test/test-asset.png',
  size: 1024,
  createdAt: Date.now(),
  modifiedAt: Date.now(),
  ...overrides,
});

export const createMockCanvasItem = (overrides = {}) => ({
  id: 'test-item-id',
  assetId: 'test-asset-id',
  type: 'image' as const,
  x: 100,
  y: 100,
  width: 200,
  height: 200,
  rotation: 0,
  scale: 1,
  zIndex: 1,
  locked: false,
  visible: true,
  src: 'data:image/png;base64,test',
  name: 'Test Item',
  createdAt: Date.now(),
  ...overrides,
});

export const createMockFileNode = (overrides = {}) => ({
  id: 'test-node-id',
  name: 'test-folder',
  type: 'folder' as const,
  path: '/test-folder',
  children: [],
  expanded: false,
  ...overrides,
});

export { localStorageMock };
