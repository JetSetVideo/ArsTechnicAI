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
import { Input } from '../ui/Input';
import { useCanvasStore } from '@/stores/canvasStore';
import { useFileStore } from '@/stores/fileStore';
import { useLogStore } from '@/stores/logStore';
import { useGeneration } from '@/hooks/useGeneration';
import { GenerationForm } from '../inspector/GenerationForm';
import styles from './InspectorPanel.module.css';

interface InspectorPanelProps {
  width: number;
  onOpenSettings: () => void;
}

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  expandable?: boolean;
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
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={sectionClasses}>
      <button type="button" className={styles.sectionHeader} onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {icon}
        <span>{title}</span>
      </button>
      {open && <div className={styles.sectionContent}>{children}</div>}
    </div>
  );
};

export const InspectorPanel: React.FC<InspectorPanelProps> = ({ width, onOpenSettings }) => {
  const {
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    width: genWidth,
    height: genHeight,
    setDimensions,
    isGenerating,
    jobs,
    selectedItem,
    handleGenerate,
  } = useGeneration(onOpenSettings, onOpenSettings);

  const { updateItem } = useCanvasStore();
  const { updateAsset } = useFileStore();
  const log = useLogStore((s) => s.log);

  const handleRenameItem = useCallback(
    (newName: string) => {
      if (selectedItem && newName.trim()) {
        updateItem(selectedItem.id, { name: newName.trim() });
        if (selectedItem.assetId) updateAsset(selectedItem.assetId, { name: newName.trim() });
        log('canvas_move', `Renamed item to: ${newName.trim()}`);
      }
    },
    [selectedItem, updateItem, updateAsset, log],
  );

  const handleUpdatePosition = useCallback(
    (axis: 'x' | 'y', value: number) => {
      if (selectedItem) updateItem(selectedItem.id, { [axis]: value });
    },
    [selectedItem, updateItem],
  );

  const handleUpdateScale = useCallback(
    (value: number) => {
      if (selectedItem) updateItem(selectedItem.id, { scale: Math.max(0.1, Math.min(5, value)) });
    },
    [selectedItem, updateItem],
  );

  const handleUpdateRotation = useCallback(
    (value: number) => {
      if (selectedItem) updateItem(selectedItem.id, { rotation: value % 360 });
    },
    [selectedItem, updateItem],
  );

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
        <CollapsibleSection title="Generate Image" icon={<Sparkles size={14} />} defaultOpen>
          <GenerationForm
            prompt={prompt}
            negativePrompt={negativePrompt}
            width={genWidth}
            height={genHeight}
            isGenerating={isGenerating}
            onPromptChange={setPrompt}
            onNegativePromptChange={setNegativePrompt}
            onDimensionsChange={setDimensions}
            onGenerate={handleGenerate}
          />
        </CollapsibleSection>

        {selectedItem && (
          <CollapsibleSection title="Selected Item" icon={<Palette size={14} />} defaultOpen>
            <div className={styles.propertyGrid}>
              <div className={styles.formGroup}>
                <Input
                  label="Name"
                  value={selectedItem.name}
                  onChange={(e) => handleRenameItem(e.target.value)}
                  placeholder="Item name..."
                />
              </div>

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

              <div className={styles.property}>
                <span className={styles.propertyLabel}>Original Size</span>
                <span className={styles.propertyValue}>
                  {selectedItem.width} &times; {selectedItem.height}
                </span>
              </div>

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

              {selectedItem.prompt && (
                <div className={styles.property}>
                  <span className={styles.propertyLabel}>Prompt</span>
                  <span className={styles.propertyValue}>{selectedItem.prompt}</span>
                </div>
              )}

              <div className={styles.property}>
                <span className={styles.propertyLabel}>Type</span>
                <span className={styles.propertyValue}>
                  {selectedItem.type === 'generated'
                    ? 'AI Generated'
                    : selectedItem.type === 'image'
                      ? 'Imported Image'
                      : 'Placeholder'}
                </span>
              </div>
            </div>
          </CollapsibleSection>
        )}

        {recentJobs.length > 0 && (
          <CollapsibleSection title="Recent Generations" icon={<History size={14} />} defaultOpen={false}>
            <div className={styles.jobList}>
              {recentJobs.map((job) => (
                <div key={job.id} className={styles.jobItem}>
                  <div className={styles.jobStatus}>
                    <span className={`${styles.statusDot} ${styles[job.status]}`} />
                    <span className={styles.jobPrompt}>{job.request.prompt.slice(0, 40)}...</span>
                  </div>
                  {job.result?.dataUrl && <img src={job.result.dataUrl} alt="" className={styles.jobThumb} />}
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </aside>
  );
};
