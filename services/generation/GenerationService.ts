/**
 * GenerationService
 *
 * Orchestrates image generation: validation, API call, store updates,
 * production tracking, and canvas/file integration.
 *
 * This is the single source of truth for generation business logic.
 * Components should call this service through the useGeneration hook
 * rather than touching stores directly.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  GENERATION_CONFIG,
  validateGenerationRequest,
  validateApiKey,
} from '../generation';
import { useGenerationStore } from '@/stores/generationStore';
import { useCanvasStore } from '@/stores/canvasStore';
import { useFileStore } from '@/stores/fileStore';
import { useLogStore } from '@/stores/logStore';
import { useToastStore, ERROR_CODES, parseAPIError } from '@/stores/toastStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUserStore } from '@/stores/userStore';
import { useProjectsStore } from '@/stores/projectsStore';
import { useProductionStore } from '@/stores/productionStore';
import type { GenerationResult, CanvasItem } from '@/types';

export interface GenerateImageInput {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  selectedItemAssetId?: string;
  onMissingApiKey?: () => void;
}

export interface GenerateImageOutput {
  success: boolean;
  canvasItem?: CanvasItem;
  assetId?: string;
  error?: string;
}

function getNextVersionLabel(existingVersions: string[]): string {
  if (existingVersions.length === 0) return '1.0';
  const parsed = existingVersions
    .map((v) => {
      const [major, minor = '0'] = v.split('.');
      return { major: Number(major) || 1, minor: Number(minor) || 0 };
    })
    .sort((a, b) => a.major - b.major || a.minor - b.minor);
  const latest = parsed[parsed.length - 1];
  return `${latest.major}.${latest.minor + 1}`;
}

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
  const { settings } = useSettingsStore.getState();
  const toast = useToastStore.getState();
  const log = useLogStore.getState().log;
  const { startGeneration, completeJob, failJob } = useGenerationStore.getState();
  const { addItem } = useCanvasStore.getState();
  const fileStore = useFileStore.getState();
  const currentProject = useUserStore.getState().currentProject;
  const { prompt, negativePrompt, width, height } = input;

  // ── Validation ─────────────────────────────────────────────
  const reqValidation = validateGenerationRequest({ prompt, width, height, model: settings.aiProvider.model });
  if (!reqValidation.valid) {
    const code = reqValidation.errorCode ?? 'GENERATION_FAILED';
    const info = ERROR_CODES[code] ?? ERROR_CODES.GENERATION_FAILED;
    toast.error(info.title, reqValidation.errorMessage ?? info.message);
    return { success: false, error: reqValidation.errorMessage };
  }

  const keyValidation = validateApiKey(settings.aiProvider.apiKey);
  if (!keyValidation.valid) {
    const info = ERROR_CODES.MISSING_API_KEY;
    toast.addToast({
      type: 'error',
      title: info.title,
      message: info.message,
      action: input.onMissingApiKey ? { label: 'Open Settings', onClick: input.onMissingApiKey } : undefined,
    });
    return { success: false, error: keyValidation.errorMessage };
  }

  // ── Start job ──────────────────────────────────────────────
  log('generation_start', `Started generating: "${prompt.slice(0, 50)}..."`, { prompt, width, height });
  toast.info('Generation Started', `Creating: "${prompt.slice(0, 40)}${prompt.length > 40 ? '...' : ''}"`, 3000);

  const job = startGeneration({
    prompt,
    negativePrompt,
    width,
    height,
    model: settings.aiProvider.model,
  });

  // ── API call ───────────────────────────────────────────────
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GENERATION_CONFIG.REQUEST_TIMEOUT_MS + 30000);

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        negativePrompt,
        width,
        height,
        apiKey: settings.aiProvider.apiKey,
        model: settings.aiProvider.model,
        endpoint: settings.aiProvider.endpoint,
        allowPlaceholderFallback: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorBody: Record<string, string> = {};
      try { errorBody = await response.json(); } catch { /* non-JSON */ }
      const errorCode = parseAPIError(response.status, errorBody);
      const errorInfo = ERROR_CODES[errorCode];
      const errorMessage = errorBody.error || errorBody.message || errorInfo.message;

      toast.error(errorInfo.title, errorMessage);
      failJob(job.id, errorMessage);
      log('generation_fail', `Generation failed: ${errorMessage}`, { error: errorMessage, status: response.status, errorCode });
      recordRun(currentProject, prompt, negativePrompt, settings, job.id, 'failed', width, height, undefined, undefined, errorMessage);
      return { success: false, error: errorMessage };
    }

    // ── Process result ─────────────────────────────────────────
    const result = await response.json();
    const imageSrc: string | undefined = result.dataUrl || result.imageUrl;
    if (!imageSrc) {
      const msg = 'No image was returned from the API.';
      toast.error(ERROR_CODES.GENERATION_FAILED.title, msg);
      failJob(job.id, msg);
      log('generation_fail', `Generation failed: ${msg}`, { error: msg });
      recordRun(currentProject, prompt, negativePrompt, settings, job.id, 'failed', width, height, undefined, undefined, msg);
      return { success: false, error: msg };
    }

    if (result.dataUrl && !result.dataUrl.startsWith('data:')) {
      const msg = 'Received invalid image data format.';
      toast.error('Generation Failed', msg);
      failJob(job.id, msg);
      recordRun(currentProject, prompt, negativePrompt, settings, job.id, 'failed', width, height, undefined, undefined, msg);
      return { success: false, error: msg };
    }

    const seed = result.seed || Math.floor(Math.random() * 1_000_000);
    const genResult: GenerationResult = {
      id: uuidv4(),
      prompt,
      imageUrl: result.imageUrl || '',
      dataUrl: result.dataUrl,
      width,
      height,
      model: settings.aiProvider.model,
      seed,
      createdAt: Date.now(),
    };
    completeJob(job.id, genResult);

    // ── Asset + Canvas + FileStore ─────────────────────────────
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const slug = prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
    const filename = `gen_${slug}_${ts}.png`;

    const existingPrompt = fileStore.findPromptAsset(prompt);
    const promptAsset = existingPrompt || fileStore.createPromptAsset(prompt);

    const selectedAsset = input.selectedItemAssetId ? fileStore.getAsset(input.selectedItemAssetId) : undefined;
    const lineageId = selectedAsset?.metadata?.lineageId || selectedAsset?.id || uuidv4();
    const parentAssetId = selectedAsset?.id;
    const lineageAssets = fileStore.getAssetsByLineage(lineageId);
    const existingVersions = lineageAssets.map((a) => a.metadata?.version).filter((v): v is string => typeof v === 'string');
    const versionLabel = getNextVersionLabel(existingVersions);

    const assetId = uuidv4();
    const maxDim = Math.min(320, Math.round((typeof window !== 'undefined' ? window.innerWidth : 1920) * 0.2));
    const genScale = Math.min(1, maxDim / Math.max(width, height));

    const canvasItem = addItem({
      type: 'generated',
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width,
      height,
      rotation: 0,
      scale: genScale,
      locked: false,
      visible: true,
      src: imageSrc,
      prompt,
      name: filename,
      assetId,
      promptId: promptAsset.id,
      lineageId,
      parentAssetId,
      version: versionLabel,
    });

    const generatedFolderPath = fileStore.getProjectGeneratedPath();
    fileStore.addAssetToFolder(
      {
        id: assetId,
        name: filename,
        type: 'image',
        path: `${generatedFolderPath}/${filename}`,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        thumbnail: imageSrc,
        metadata: { width, height, prompt, model: settings.aiProvider.model, seed, promptId: promptAsset.id, lineageId, parentAssetId, version: versionLabel },
      },
      generatedFolderPath,
    );

    useProjectsStore.getState().updateProject(currentProject.id, { thumbnail: imageSrc });
    recordRun(currentProject, prompt, negativePrompt, settings, job.id, 'completed', width, height, assetId, seed);

    toast.success('Image Generated', `Successfully created: ${filename}`, 5000);
    log('generation_complete', `Generated: ${filename}`, { prompt, filename, seed });
    if (settings.autoSavePrompts) {
      log('prompt_save', `Saved prompt: "${prompt.slice(0, 30)}..."`, { prompt });
    }

    return { success: true, canvasItem: canvasItem ?? undefined, assetId };
  } catch (error) {
    clearTimeout(timeoutId);

    let errorTitle: string;
    let errorMessage: string;
    let errorCode: string;

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        ({ title: errorTitle, message: errorMessage } = ERROR_CODES.TIMEOUT);
        errorCode = 'TIMEOUT';
      } else if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        ({ title: errorTitle, message: errorMessage } = ERROR_CODES.NETWORK_ERROR);
        errorCode = 'NETWORK_ERROR';
      } else {
        errorTitle = ERROR_CODES.UNKNOWN_ERROR.title;
        errorMessage = error.message || ERROR_CODES.UNKNOWN_ERROR.message;
        errorCode = 'UNKNOWN_ERROR';
      }
    } else {
      ({ title: errorTitle, message: errorMessage } = ERROR_CODES.UNKNOWN_ERROR);
      errorCode = 'UNKNOWN_ERROR';
    }

    toast.error(errorTitle, errorMessage);
    failJob(job.id, errorMessage);
    recordRun(currentProject, prompt, negativePrompt, settings, job.id, 'failed', width, height, undefined, undefined, errorMessage);
    log('generation_fail', `Generation failed: ${errorMessage}`, { error: errorMessage, errorCode });
    return { success: false, error: errorMessage };
  }
}

// ── Helper: record production tracking run ─────────────────
function recordRun(
  project: { id: string; name: string },
  prompt: string,
  negativePrompt: string,
  settings: ReturnType<typeof useSettingsStore.getState>['settings'],
  jobId: string,
  status: 'completed' | 'failed',
  width: number,
  height: number,
  outputAssetId?: string,
  seed?: number,
  errorMessage?: string,
) {
  useProductionStore.getState().recordPromptRun({
    projectId: project.id,
    projectName: project.name,
    promptText: prompt,
    negativePrompt,
    provider: settings.aiProvider.provider,
    model: settings.aiProvider.model,
    generationJobId: jobId,
    status,
    width,
    height,
    steps: settings.aiProvider.defaultSteps,
    guidanceScale: settings.aiProvider.defaultGuidanceScale,
    outputAssetId,
    seed,
    errorMessage,
  });
}
