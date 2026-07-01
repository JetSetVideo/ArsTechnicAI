// ============================================================
// ARS TECHNICAI — CLIP Text Encode Node (COMFY-005)
// Takes prompt text + CLIP model → outputs 'conditioning'.
// Positive and negative prompt encoding with auto-chunking.
// ============================================================

import type { ModuleDef, ModuleContext, ModuleResult } from '@/types/module';

export const id = 'gen.clip.encode';

export const moduleDef: ModuleDef = {
  id,
  name: 'CLIP Text Encode',
  category: 'generate',
  description: 'Encode text prompts using CLIP model into conditioning vectors for image generation. Supports positive (what to generate) and negative (what to avoid) prompts. Auto-chunks prompts exceeding 77 tokens. Outputs conditioning for sampler nodes.',
  inputs: [
    { id: 'prompt', label: 'Prompt Text', type: 'text', direction: 'input' },
    { id: 'clip', label: 'CLIP Model', type: 'model', direction: 'input', optional: true },
  ],
  outputs: [
    { id: 'conditioning', label: 'Positive Conditioning', type: 'conditioning', direction: 'output' },
    { id: 'negativeConditioning', label: 'Negative Conditioning', type: 'conditioning', direction: 'output', optional: true },
    { id: 'pooledOutput', label: 'Pooled Output', type: 'data', direction: 'output', optional: true },
  ],
  parameters: [
    { id: 'prompt', label: 'Positive Prompt', type: 'string', default: '' },
    { id: 'negativePrompt', label: 'Negative Prompt', type: 'string', default: 'blurry, low quality, distorted, bad anatomy' },
    { id: 'maxTokens', label: 'Max Tokens Per Chunk', type: 'number', default: 77, min: 1, max: 77 },
    { id: 'weight', label: 'Prompt Weight', type: 'number', default: 1, min: 0, max: 2, step: 0.05 },
    { id: 'truncate', label: 'Truncate (not chunk)', type: 'boolean', default: false },
  ],
  execute: async (ctx: ModuleContext): Promise<ModuleResult> => {
    const prompt = (ctx.parameters.prompt as string) || (ctx.inputs.prompt as string) || '';
    const negativePrompt = (ctx.parameters.negativePrompt as string) || 'blurry, low quality, distorted, bad anatomy';
    const maxTokens = (ctx.parameters.maxTokens as number) || 77;
    const weight = (ctx.parameters.weight as number) || 1;
    const truncate = ctx.parameters.truncate === true;

    // Simulate tokenization (real CLIP uses BPE tokenizer)
    const posTokens = estimateTokens(prompt, maxTokens, truncate);
    const negTokens = estimateTokens(negativePrompt, maxTokens, truncate);

    ctx.onProgress?.(50, `Encoding ${posTokens.chunks} positive + ${negTokens.chunks} negative chunk(s)...`);
    ctx.onProgress?.(100, `CLIP encode complete (${posTokens.totalTokens} tokens)`);

    // Build conditioning output
    const conditioning = {
      type: 'clip-embedding',
      model: 'CLIP ViT-L/14',
      positiveChunks: posTokens.chunks,
      negativeChunks: negTokens.chunks,
      totalTokens: posTokens.totalTokens + negTokens.totalTokens,
      weight,
      prompt,
      negativePrompt,
    };

    return {
      outputs: {
        conditioning,
        negativeConditioning: { ...conditioning, prompt: negativePrompt },
        pooledOutput: conditioning,
      },
      metadata: {
        posTokens: posTokens.totalTokens,
        negTokens: negTokens.totalTokens,
        posChunks: posTokens.chunks,
        negChunks: negTokens.chunks,
        weight,
        truncated: posTokens.wasTruncated || negTokens.wasTruncated,
      },
    };
  },
};

interface TokenEstimate {
  totalTokens: number;
  chunks: number;
  wasTruncated: boolean;
}

function estimateTokens(text: string, maxPerChunk: number, truncate: boolean): TokenEstimate {
  // Rough estimate: ~0.75 tokens per word for CLIP
  const words = text.split(/\s+/).filter(Boolean);
  const estimatedTokens = Math.ceil(words.length * 0.75);

  if (truncate || estimatedTokens <= maxPerChunk) {
    return {
      totalTokens: Math.min(estimatedTokens, maxPerChunk),
      chunks: 1,
      wasTruncated: estimatedTokens > maxPerChunk,
    };
  }

  const chunks = Math.ceil(estimatedTokens / maxPerChunk);
  return {
    totalTokens: estimatedTokens,
    chunks,
    wasTruncated: false,
  };
}
