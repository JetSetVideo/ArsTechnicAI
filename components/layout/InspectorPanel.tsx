import React, { useCallback, useState } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  Copy,
  Save,
  History,
  Palette,
  ImagePlus,
  Trash2,
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
} from '@/stores';
import styles from './InspectorPanel.module.css';
import type { CanvasItem, GenerationResult } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface InspectorPanelProps {
  width: number;
  onOpenSettings: () => void;
}

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  defaultOpen = true,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={styles.section}>
      <button
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
  const { addItem } = useCanvasStore();
  const { addAsset } = useFileStore();
  const log = useLogStore((s) => s.log);
  const selectedItems = useCanvasStore((s) => s.getSelectedItems());
  const selectedItem = selectedItems[0];

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    if (!settings.aiProvider.apiKey) {
      alert('Please enter your NanoBanana API key in Settings (⌘,)');
      return;
    }

    log('generation_start', `Started generating: "${prompt.slice(0, 50)}..."`, {
      prompt,
      width: genWidth,
      height: genHeight,
    });

    const job = startGeneration({
      prompt,
      negativePrompt,
      width: genWidth,
      height: genHeight,
      model: settings.aiProvider.model,
    });

    try {
      // Call our API route
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          negativePrompt,
          width: genWidth,
          height: genHeight,
          apiKey: settings.aiProvider.apiKey,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Generation failed');
      }

      const result = await response.json();

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

      // Add to canvas
      const canvasItem = addItem({
        type: 'generated',
        x: 100 + Math.random() * 200,
        y: 100 + Math.random() * 200,
        width: genWidth,
        height: genHeight,
        rotation: 0,
        scale: 0.5,
        locked: false,
        visible: true,
        src: result.dataUrl || result.imageUrl,
        prompt,
        name: filename,
      });

      // Add to file system
      addAsset({
        id: uuidv4(),
        name: filename,
        type: 'image',
        path: `/generated/${filename}`,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        thumbnail: result.dataUrl || result.imageUrl,
        metadata: {
          width: genWidth,
          height: genHeight,
          prompt,
          model: settings.aiProvider.model,
          seed: generationResult.seed,
        },
      });

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
      const message = error instanceof Error ? error.message : 'Unknown error';
      failJob(job.id, message);
      log('generation_fail', `Generation failed: ${message}`, { error: message });
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
    addAsset,
    log,
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
            defaultOpen={true}
          >
            <div className={styles.propertyGrid}>
              <div className={styles.property}>
                <span className={styles.propertyLabel}>Name</span>
                <span className={styles.propertyValue}>{selectedItem.name}</span>
              </div>
              <div className={styles.property}>
                <span className={styles.propertyLabel}>Position</span>
                <span className={styles.propertyValue}>
                  {Math.round(selectedItem.x)}, {Math.round(selectedItem.y)}
                </span>
              </div>
              <div className={styles.property}>
                <span className={styles.propertyLabel}>Size</span>
                <span className={styles.propertyValue}>
                  {selectedItem.width} × {selectedItem.height}
                </span>
              </div>
              {selectedItem.prompt && (
                <div className={styles.property}>
                  <span className={styles.propertyLabel}>Prompt</span>
                  <span className={styles.propertyValue}>{selectedItem.prompt}</span>
                </div>
              )}
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
