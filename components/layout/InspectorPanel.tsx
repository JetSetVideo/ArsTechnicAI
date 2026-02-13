import React, { useCallback, useState } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  History,
  Palette,
  Settings2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import {
  useGenerationStore,
  useCanvasStore,
  useSettingsStore,
  useLogStore,
  useFileStore,
  useToastStore,
  ERROR_CODES,
  parseAPIError,
  useUserStore,
} from '@/stores';
import { useProjectsStore } from '@/stores/projectsStore';
import styles from './InspectorPanel.module.css';
import type { GenerationResult } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface InspectorPanelProps {
  width: number;
  onOpenSettings: () => void;
}

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  expandable?: boolean; // If true, section can grow to fill available space
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  defaultOpen = true,
  expandable = false,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  const sectionClasses = [
    styles.section,
    open ? styles.expanded : '',
    expandable && open ? styles.expandable : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={sectionClasses}>
      <button
        type="button"
        className={styles.sectionHeader}
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {icon}
        <span>{title}</span>
      </button>
      {open && <div className={styles.sectionContent}>{children}</div>}
    </div>
  );
};

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  width,
  onOpenSettings,
}) => {
  const {
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    width: genWidth,
    height: genHeight,
    setDimensions,
    isGenerating,
    startGeneration,
    completeJob,
    failJob,
    jobs,
  } = useGenerationStore();

  const { settings } = useSettingsStore();
  const { addItem, updateItem } = useCanvasStore();
  const {
    addAssetToFolder,
    updateAsset,
    getProjectGeneratedPath,
    getAsset,
    findPromptAsset,
    createPromptAsset,
    getAssetsByLineage,
  } = useFileStore();
  const log = useLogStore((s) => s.log);
  const toast = useToastStore();
  const selectedItems = useCanvasStore((s) => s.getSelectedItems());
  const selectedItem = selectedItems[0];
  const currentProject = useUserStore((s) => s.currentProject);

  // Handler for renaming selected item
  const handleRenameItem = useCallback((newName: string) => {
    if (selectedItem && newName.trim()) {
      updateItem(selectedItem.id, { name: newName.trim() });
      // Also update the asset if it exists
      if (selectedItem.assetId) {
        updateAsset(selectedItem.assetId, { name: newName.trim() });
      }
      log('canvas_move', `Renamed item to: ${newName.trim()}`);
    }
  }, [selectedItem, updateItem, updateAsset, log]);

  // Handler for updating position
  const handleUpdatePosition = useCallback((axis: 'x' | 'y', value: number) => {
    if (selectedItem) {
      updateItem(selectedItem.id, { [axis]: value });
    }
  }, [selectedItem, updateItem]);

  // Handler for updating scale
  const handleUpdateScale = useCallback((value: number) => {
    if (selectedItem) {
      updateItem(selectedItem.id, { scale: Math.max(0.1, Math.min(5, value)) });
    }
  }, [selectedItem, updateItem]);

  // Handler for updating rotation
  const handleUpdateRotation = useCallback((value: number) => {
    if (selectedItem) {
      updateItem(selectedItem.id, { rotation: value % 360 });
    }
  }, [selectedItem, updateItem]);

  const getNextVersionLabel = useCallback((existingVersions: string[]) => {
    if (existingVersions.length === 0) return '1.0';

    const parsed = existingVersions
      .map((v) => {
        const [major, minor = '0'] = v.split('.');
        return {
          major: Number(major) || 1,
          minor: Number(minor) || 0,
        };
      })
      .sort((a, b) => (a.major - b.major) || (a.minor - b.minor));

    const latest = parsed[parsed.length - 1];
    return `${latest.major}.${latest.minor + 1}`;
  }, []);

  const handleGenerate = useCallback(async () => {
    // ═══════════════════════════════════════════════════════════
    // VALIDATION PHASE - Check all inputs before making request
    // ═══════════════════════════════════════════════════════════
    
    // Check for empty prompt
    if (!prompt.trim()) {
      const err = ERROR_CODES.EMPTY_PROMPT;
      toast.error(err.title, err.message);
      return;
    }

    // Check for API key
    if (!settings.aiProvider.apiKey) {
      const err = ERROR_CODES.MISSING_API_KEY;
      toast.addToast({
        type: 'error',
        title: err.title,
        message: err.message,
        action: {
          label: 'Open Settings',
          onClick: onOpenSettings,
        },
      });
      return;
    }

    // Validate dimensions
    if (genWidth < 256 || genWidth > 2048 || genHeight < 256 || genHeight > 2048) {
      const err = ERROR_CODES.INVALID_DIMENSIONS;
      toast.error(err.title, err.message);
      return;
    }

    // Check prompt length (most APIs have limits)
    if (prompt.length > 4000) {
      const err = ERROR_CODES.PROMPT_TOO_LONG;
      toast.error(err.title, err.message);
      return;
    }

    // ═══════════════════════════════════════════════════════════
    // GENERATION PHASE - Start the generation job
    // ═══════════════════════════════════════════════════════════
    
    log('generation_start', `Started generating: "${prompt.slice(0, 50)}..."`, {
      prompt,
      width: genWidth,
      height: genHeight,
    });

    toast.info(
      'Generation Started',
      `Creating: "${prompt.slice(0, 40)}${prompt.length > 40 ? '...' : ''}"`,
      3000
    );

    const job = startGeneration({
      prompt,
      negativePrompt,
      width: genWidth,
      height: genHeight,
      model: settings.aiProvider.model,
    });

    // ═══════════════════════════════════════════════════════════
    // REQUEST PHASE - Make the API call with timeout
    // ═══════════════════════════════════════════════════════════
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          negativePrompt,
          width: genWidth,
          height: genHeight,
          apiKey: settings.aiProvider.apiKey,
          model: settings.aiProvider.model,
          endpoint: settings.aiProvider.endpoint,
          // Placeholder fallback can mask config issues; keep it off by default.
          allowPlaceholderFallback: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // ═══════════════════════════════════════════════════════════
      // ERROR HANDLING - Parse response errors
      // ═══════════════════════════════════════════════════════════
      
      if (!response.ok) {
        let errorBody: any = {};
        try {
          errorBody = await response.json();
        } catch {
          // Response might not be JSON
        }

        // Parse the error code from status and body
        const errorCode = parseAPIError(response.status, errorBody);
        const errorInfo = ERROR_CODES[errorCode];
        
        // Use specific message from API if available
        const errorMessage = errorBody.error || errorBody.message || errorInfo.message;
        
        toast.error(errorInfo.title, errorMessage);
        failJob(job.id, errorMessage);
        log('generation_fail', `Generation failed: ${errorMessage}`, { 
          error: errorMessage,
          status: response.status,
          errorCode,
        });
        return;
      }

      // ═══════════════════════════════════════════════════════════
      // SUCCESS PHASE - Process the generated image
      // ═══════════════════════════════════════════════════════════
      
      const result = await response.json();

      // Debug: Log the result
      console.log('[Generation] API Response:', {
        hasDataUrl: !!result.dataUrl,
        dataUrlLength: result.dataUrl?.length || 0,
        dataUrlPreview: result.dataUrl?.slice(0, 50),
        hasImageUrl: !!result.imageUrl,
        seed: result.seed,
      });

      // Validate we got an actual image
      const imageSrc = result.dataUrl || result.imageUrl;
      if (!imageSrc) {
        const err = ERROR_CODES.GENERATION_FAILED;
        toast.error(err.title, 'No image was returned from the API.');
        failJob(job.id, 'No image returned');
        log('generation_fail', 'Generation failed: No image returned', { error: 'No image returned' });
        return;
      }

      // Validate the data URL format
      if (result.dataUrl && !result.dataUrl.startsWith('data:')) {
        console.error('[Generation] Invalid dataUrl format:', result.dataUrl.slice(0, 100));
        toast.error('Generation Failed', 'Received invalid image data format.');
        failJob(job.id, 'Invalid image data format');
        log('generation_fail', 'Generation failed: Invalid image format', { error: 'Invalid format' });
        return;
      }

      // Create a proper result object
      const generationResult: GenerationResult = {
        id: uuidv4(),
        prompt,
        imageUrl: result.imageUrl || '',
        dataUrl: result.dataUrl,
        width: genWidth,
        height: genHeight,
        model: settings.aiProvider.model,
        seed: result.seed || Math.floor(Math.random() * 1000000),
        createdAt: Date.now(),
      };

      completeJob(job.id, generationResult);

      // Generate coherent filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const promptSlug = prompt
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 30);
      const filename = `gen_${promptSlug}_${timestamp}.png`;

      console.log('[Generation] Adding to canvas:', {
        filename,
        srcLength: imageSrc.length,
        srcPreview: imageSrc.slice(0, 80),
      });

      // Prepare prompt and lineage metadata
      const existingPrompt = findPromptAsset(prompt);
      const promptAsset = existingPrompt || createPromptAsset(prompt);

      const selectedAsset = selectedItem?.assetId ? getAsset(selectedItem.assetId) : undefined;
      const lineageId = selectedAsset?.metadata?.lineageId || selectedAsset?.id || uuidv4();
      const parentAssetId = selectedAsset?.id;
      const lineageAssets = getAssetsByLineage(lineageId);
      const existingVersions = lineageAssets
        .map((asset) => asset.metadata?.version)
        .filter((v): v is string => typeof v === 'string');
      const versionLabel = getNextVersionLabel(existingVersions);

      // Create asset id and add to canvas — scale to ~20% of viewport
      const assetId = uuidv4();
      const maxDim = Math.min(320, Math.round(window.innerWidth * 0.2));
      const genScale = Math.min(1, maxDim / Math.max(genWidth, genHeight));
      const canvasItem = addItem({
        type: 'generated',
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
        width: genWidth,
        height: genHeight,
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

      console.log('[Generation] Canvas item created:', canvasItem?.id);

      // Add to file system and project folder
      const generatedFolderPath = getProjectGeneratedPath();
      
      console.log('[Generation] Adding to folder:', generatedFolderPath);
      
      addAssetToFolder(
        {
          id: assetId,
          name: filename,
          type: 'image',
          path: `${generatedFolderPath}/${filename}`,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          thumbnail: imageSrc,
          metadata: {
            width: genWidth,
            height: genHeight,
            prompt,
            model: settings.aiProvider.model,
            seed: generationResult.seed,
            promptId: promptAsset.id,
            lineageId,
            parentAssetId,
            version: versionLabel,
          },
        },
        generatedFolderPath
      );

      // Update dashboard project card preview + stats from actual generation output.
      useProjectsStore.getState().updateProject(currentProject.id, {
        thumbnail: imageSrc,
      });

      // Show success toast
      toast.success(
        'Image Generated',
        `Successfully created: ${filename}`,
        5000
      );

      log('generation_complete', `Generated: ${filename}`, {
        prompt,
        filename,
        seed: generationResult.seed,
      });

      // Save prompt if auto-save enabled
      if (settings.autoSavePrompts) {
        log('prompt_save', `Saved prompt: "${prompt.slice(0, 30)}..."`, { prompt });
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      // ═══════════════════════════════════════════════════════════
      // CATCH-ALL ERROR HANDLING
      // ═══════════════════════════════════════════════════════════
      
      let errorTitle: string;
      let errorMessage: string;
      let errorCode: string;

      if (error instanceof Error) {
        // Handle abort/timeout
        if (error.name === 'AbortError') {
          const err = ERROR_CODES.TIMEOUT;
          errorTitle = err.title;
          errorMessage = err.message;
          errorCode = 'TIMEOUT';
        }
        // Handle network errors
        else if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
          const err = ERROR_CODES.NETWORK_ERROR;
          errorTitle = err.title;
          errorMessage = err.message;
          errorCode = 'NETWORK_ERROR';
        }
        // Handle other errors
        else {
          const err = ERROR_CODES.UNKNOWN_ERROR;
          errorTitle = err.title;
          errorMessage = error.message || err.message;
          errorCode = 'UNKNOWN_ERROR';
        }
      } else {
        const err = ERROR_CODES.UNKNOWN_ERROR;
        errorTitle = err.title;
        errorMessage = err.message;
        errorCode = 'UNKNOWN_ERROR';
      }

      toast.error(errorTitle, errorMessage);
      failJob(job.id, errorMessage);
      log('generation_fail', `Generation failed: ${errorMessage}`, { 
        error: errorMessage,
        errorCode,
      });
    }
  }, [
    prompt,
    negativePrompt,
    genWidth,
    genHeight,
    settings.aiProvider.apiKey,
    settings,
    startGeneration,
    completeJob,
    failJob,
    addItem,
    addAssetToFolder,
    getProjectGeneratedPath,
    getAsset,
    findPromptAsset,
    createPromptAsset,
    getAssetsByLineage,
    getNextVersionLabel,
    selectedItem,
    log,
    toast,
    onOpenSettings,
    currentProject.id,
  ]);

  const recentJobs = jobs.slice(0, 5);

  return (
    <aside className={styles.inspector} style={{ width }}>
      <div className={styles.header}>
        <h2 className={styles.title}>Inspector</h2>
        <Button variant="ghost" size="sm" onClick={onOpenSettings} title="Settings">
          <Settings2 size={14} />
        </Button>
      </div>

      <div className={styles.content}>
        {/* Generation Section */}
        <CollapsibleSection
          title="Generate Image"
          icon={<Sparkles size={14} />}
          defaultOpen={true}
        >
          <div className={styles.formGroup}>
            <Textarea
              label="Prompt"
              placeholder="Describe the image you want to create..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
            />
          </div>

          <div className={styles.formGroup}>
            <Textarea
              label="Negative Prompt (optional)"
              placeholder="What to avoid..."
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              rows={2}
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <Input
                label="Width"
                type="number"
                value={genWidth}
                onChange={(e) =>
                  setDimensions(parseInt(e.target.value) || 1024, genHeight)
                }
                min={256}
                max={2048}
                step={64}
              />
            </div>
            <div className={styles.formGroup}>
              <Input
                label="Height"
                type="number"
                value={genHeight}
                onChange={(e) =>
                  setDimensions(genWidth, parseInt(e.target.value) || 1024)
                }
                min={256}
                max={2048}
                step={64}
              />
            </div>
          </div>

          <Button
            variant="primary"
            className={styles.generateButton}
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            loading={isGenerating}
            icon={<Sparkles size={16} />}
          >
            {isGenerating ? 'Generating...' : 'Generate'}
          </Button>
        </CollapsibleSection>

        {/* Selected Item Properties */}
        {selectedItem && (
          <CollapsibleSection
            title="Selected Item"
            icon={<Palette size={14} />}
            defaultOpen
          >
            <div className={styles.propertyGrid}>
              {/* Editable Name */}
              <div className={styles.formGroup}>
                <Input
                  label="Name"
                  value={selectedItem.name}
                  onChange={(e) => handleRenameItem(e.target.value)}
                  placeholder="Item name..."
                />
              </div>

              {/* Position */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <Input
                    label="X"
                    type="number"
                    value={Math.round(selectedItem.x)}
                    onChange={(e) => handleUpdatePosition('x', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <Input
                    label="Y"
                    type="number"
                    value={Math.round(selectedItem.y)}
                    onChange={(e) => handleUpdatePosition('y', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Size (read-only for now, just display) */}
              <div className={styles.property}>
                <span className={styles.propertyLabel}>Original Size</span>
                <span className={styles.propertyValue}>
                  {selectedItem.width} × {selectedItem.height}
                </span>
              </div>

              {/* Scale and Rotation */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <Input
                    label="Scale"
                    type="number"
                    value={selectedItem.scale.toFixed(2)}
                    onChange={(e) => handleUpdateScale(parseFloat(e.target.value) || 1)}
                    min={0.1}
                    max={5}
                    step={0.1}
                  />
                </div>
                <div className={styles.formGroup}>
                  <Input
                    label="Rotation"
                    type="number"
                    value={Math.round(selectedItem.rotation)}
                    onChange={(e) => handleUpdateRotation(parseInt(e.target.value) || 0)}
                    min={-360}
                    max={360}
                    step={1}
                  />
                </div>
              </div>

              {/* Prompt (if generated) */}
              {selectedItem.prompt && (
                <div className={styles.property}>
                  <span className={styles.propertyLabel}>Prompt</span>
                  <span className={styles.propertyValue}>{selectedItem.prompt}</span>
                </div>
              )}

              {/* Item type indicator */}
              <div className={styles.property}>
                <span className={styles.propertyLabel}>Type</span>
                <span className={styles.propertyValue}>
                  {selectedItem.type === 'generated' ? 'AI Generated' : 
                   selectedItem.type === 'image' ? 'Imported Image' : 'Placeholder'}
                </span>
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* Recent Generations */}
        {recentJobs.length > 0 && (
          <CollapsibleSection
            title="Recent Generations"
            icon={<History size={14} />}
            defaultOpen={false}
          >
            <div className={styles.jobList}>
              {recentJobs.map((job) => (
                <div key={job.id} className={styles.jobItem}>
                  <div className={styles.jobStatus}>
                    <span
                      className={`${styles.statusDot} ${styles[job.status]}`}
                    />
                    <span className={styles.jobPrompt}>
                      {job.request.prompt.slice(0, 40)}...
                    </span>
                  </div>
                  {job.result?.dataUrl && (
                    <img
                      src={job.result.dataUrl}
                      alt=""
                      className={styles.jobThumb}
                    />
                  )}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </aside>
  );
};
