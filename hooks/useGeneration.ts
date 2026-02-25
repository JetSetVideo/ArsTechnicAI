/**
 * useGeneration
 *
 * Thin React hook that exposes generation form state and delegates
 * execution to GenerationService. Components should use this hook
 * instead of calling stores directly.
 */

import { useCallback } from 'react';
import { useGenerationStore } from '@/stores/generationStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { generateImage, type GenerateImageOutput } from '@/services/generation/GenerationService';

export function useGeneration(
  onMissingApiKey?: () => void,
  onModelAccessRestricted?: () => void,
) {
  const {
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    width,
    height,
    setDimensions,
    isGenerating,
    jobs,
  } = useGenerationStore();

  const selectedItems = useCanvasStore((s) => s.getSelectedItems());
  const selectedItem = selectedItems[0] ?? null;

  const handleGenerate = useCallback(async (): Promise<GenerateImageOutput> => {
    return generateImage({
      prompt,
      negativePrompt,
      width,
      height,
      selectedItemAssetId: selectedItem?.assetId,
      onMissingApiKey,
      onModelAccessRestricted,
    });
  }, [prompt, negativePrompt, width, height, selectedItem?.assetId, onMissingApiKey, onModelAccessRestricted]);

  return {
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    width,
    height,
    setDimensions,
    isGenerating,
    jobs,
    selectedItem,
    handleGenerate,
  };
}
