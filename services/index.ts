/**
 * Services Index
 * 
 * Central export point for all service modules.
 * Services contain business logic that can be shared
 * between API routes, components, and stores.
 */

// Generation Service
export {
  // Config
  GENERATION_CONFIG,
  DEFAULT_BACKEND_CONFIG,
  type SupportedModel,
  type BackendConfig,

  // Validation
  validateGenerationRequest,
  validateApiKey,
  type ValidationResult,

  // Transformation
  normalizeRequest,
  sanitizePromptForLogging,
  sanitizeApiKeyForLogging,

  // Hash Utilities
  hashString,
  generateSeedFromPrompt,

  // Placeholder Generation
  generateVisualPlaceholder,
  svgToDataUrl,

  // Error Handling
  mapStatusToErrorCode,

  // Result Formatting
  createSuccessResult,
  createGeneratedFilename,

  // Future Backend Integration
  submitToBackend,
  checkJobStatus,
} from './generation';
