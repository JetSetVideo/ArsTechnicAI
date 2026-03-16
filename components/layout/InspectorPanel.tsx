import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  History,
  Palette,
  RotateCcw,
  BookOpen,
  Loader2,
  Clock,
  Cloud,
  PanelRight,
  Cpu,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import {
  useGenerationStore,
  useCanvasStore,
  useSettingsStore,
  useLogStore,
  useFileStore,
  useProjectStore,
} from '@/stores';
import { RECOMMENDED_GENERATION_MODELS } from '@/stores/settingsStore';
import type { GenerationResult } from '@/types';
import styles from './InspectorPanel.module.css';

interface InspectorPanelProps {
  width: number;
  onOpenSettings: () => void;
  onToggle: () => void;
}

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  expandable?: boolean;
  children: React.ReactNode;
  badge?: number;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title, icon, defaultOpen = true, expandable, children, badge,
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
      <button className={styles.sectionHeader} onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {icon}
        <span>{title}</span>
        {badge != null && badge > 0 && <span className={styles.sectionBadge}>{badge}</span>}
      </button>
      {open && <div className={styles.sectionContent}>{children}</div>}
    </div>
  );
};

// ─── Version history section ──────────────────────────────────────────────────
interface Version {
  id: string;
  version: number;
  label: string | null;
  trigger: string;
  createdAt: string;
}

const VersionHistorySection: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const log = useLogStore((s) => s.log);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/projects/${projectId}/versions?pageSize=10`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setVersions(d?.data ?? []))
      .catch(() => { setVersions([]); })
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleRestore = useCallback(async (v: Version) => {
    if (!confirm(`Restore to v${v.version} — "${v.label ?? v.trigger}"? This creates a new version.`)) return;
    setRestoring(v.id);
    try {
      const res = await fetch(`/api/projects/${projectId}/versions/${v.id}/restore`, { method: 'POST' });
      if (res.ok) {
        log('version_restore', `Restored to v${v.version}`);
        window.location.reload(); // Reload to refresh canvas state
      }
    } catch {
      log('version_restore', 'Restore failed');
    } finally {
      setRestoring(null);
    }
  }, [projectId, log]);

  const triggerLabel = (t: string) => {
    const map: Record<string, string> = {
      MANUAL: 'Manual', AUTO: 'Auto', GENERATE: 'Generate', DELETE: 'Delete', RESTORE: 'Restore',
    };
    return map[t] ?? t;
  };

  if (loading) return (
    <div className={styles.versionLoading}><Loader2 size={12} className={styles.spin} /> Loading…</div>
  );

  if (versions.length === 0) return (
    <p className={styles.hint}>No versions yet. Save the project to create one.</p>
  );

  return (
    <div className={styles.versionList}>
      {versions.map((v) => (
        <div key={v.id} className={styles.versionRow}>
          <div className={styles.versionInfo}>
            <span className={styles.versionNum}>v{v.version}</span>
            <span className={styles.versionLabel}>{v.label ?? triggerLabel(v.trigger)}</span>
          </div>
          <div className={styles.versionMeta}>
            <Clock size={10} />
            {new Date(v.createdAt).toLocaleDateString()}
          </div>
          <button
            className={styles.restoreBtn}
            onClick={() => handleRestore(v)}
            disabled={!!restoring}
            title="Restore this version"
          >
            {restoring === v.id ? <Loader2 size={10} className={styles.spin} /> : <RotateCcw size={10} />}
          </button>
        </div>
      ))}
    </div>
  );
};

// ─── Prompt templates section ─────────────────────────────────────────────────
interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  template: string;
  variables: Record<string, string>;
}

const PromptTemplatesSection: React.FC<{ onUse: (text: string) => void; isAuthenticated: boolean }> = ({ onUse, isAuthenticated }) => {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setTemplates([]);
      return;
    }
    setLoading(true);
    fetch('/api/prompts/templates?pageSize=20')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setTemplates(d?.data ?? []))
      .catch(() => { setTemplates([]); })
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const fillTemplate = (template: PromptTemplate) => {
    let text = template.template;
    for (const [k, v] of Object.entries(template.variables)) {
      text = text.replace(new RegExp(`{{${k}}}`, 'g'), v || `[${k}]`);
    }
    return text;
  };

  if (loading) return (
    <div className={styles.versionLoading}><Loader2 size={12} className={styles.spin} /> Loading…</div>
  );

  if (templates.length === 0) return (
    <p className={styles.hint}>No prompt templates found.</p>
  );

  return (
    <div className={styles.templateList}>
      {templates.map((t) => (
        <div key={t.id} className={styles.templateCard}>
          <div className={styles.templateHeader} onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
            <span className={styles.templateCategory}>{t.category}</span>
            <span className={styles.templateName}>{t.name}</span>
            <button
              className={styles.useTemplateBtn}
              onClick={(e) => { e.stopPropagation(); onUse(fillTemplate(t)); }}
              title="Use this template"
            >
              Use
            </button>
          </div>
          {expanded === t.id && (
            <div className={styles.templateBody}>
              <p className={styles.templateText}>{t.template}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const BananaIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4 13c3.5-2 8-2 10 2a5.5 5.5 0 0 1 4 5" />
    <path d="M5.1 15c5.5-2.8 11-2.8 15 2" />
    <path d="M5 15a7 7 0 0 0 14 0" />
    <path d="M5 15c5.5-2.8 11-2.8 15 2" />
  </svg>
);

// ─── Main InspectorPanel ──────────────────────────────────────────────────────
export const InspectorPanel: React.FC<InspectorPanelProps> = ({ width, onOpenSettings, onToggle }) => {
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === 'authenticated' && !!session?.user;

  const {
    prompt, setPrompt, negativePrompt, setNegativePrompt,
    width: genWidth, height: genHeight, setDimensions,
    isGenerating, startGeneration, completeJob, failJob, jobs,
  } = useGenerationStore();

  const { updateItem, addItem } = useCanvasStore();
  const { updateAsset, addAsset } = useFileStore();
  const settings = useSettingsStore((s) => s);
  const updateAIProvider = useSettingsStore((s) => s.updateAIProvider);
  const log = useLogStore((s) => s.log);
  const selectedItems = useCanvasStore((s) => s.getSelectedItems());
  const selectedItem = selectedItems[0];
  const { projectId, markDirty } = useProjectStore();

  const [localApiKey, setLocalApiKey] = useState(settings.aiProvider?.apiKey || '');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showNegativePrompt, setShowNegativePrompt] = useState(false);
  const [showNegativeTemplates, setShowNegativeTemplates] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    if (showModelDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModelDropdown]);

  // Sync localApiKey when settings change from DB sync
  useEffect(() => {
    if (settings.aiProvider?.apiKey) {
      setLocalApiKey(settings.aiProvider.apiKey);
    }
  }, [settings.aiProvider?.apiKey]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    if (localApiKey !== settings.aiProvider?.apiKey) {
      updateAIProvider({ apiKey: localApiKey });
    }

    if (!localApiKey) {
      alert('Please enter your API key in the settings below');
      return;
    }

    log('generation_start', `Started generating: "${prompt.slice(0, 50)}…"`, { prompt, width: genWidth, height: genHeight });

    const job = startGeneration({ prompt, negativePrompt, width: genWidth, height: genHeight, model: settings.aiProvider?.model ?? 'imagen-3.0-generate-002' });

    try {
      const body: Record<string, unknown> = {
        prompt, negativePrompt, width: genWidth, height: genHeight, apiKey: localApiKey,
      };
      if (isAuthenticated && projectId) body.projectId = projectId;

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || 'Generation failed');
      }

      const result = await response.json();

      const generationResult: GenerationResult = {
        id: uuidv4(),
        prompt,
        imageUrl: result.imageUrl || '',
        dataUrl: result.dataUrl,
        width: genWidth,
        height: genHeight,
        model: settings.aiProvider?.model ?? 'imagen-3.0-generate-002',
        seed: result.seed || Math.floor(Math.random() * 1000000),
        createdAt: Date.now(),
      };

      completeJob(job.id, generationResult);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const promptSlug = prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
      const filename = `gen_${promptSlug}_${timestamp}.png`;

      addItem({
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
        assetId: result.assetId,
      });

      addAsset({
        id: result.assetId ?? uuidv4(),
        name: filename,
        type: 'image',
        path: `/generated/${filename}`,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        thumbnail: result.dataUrl || result.imageUrl,
        metadata: { width: genWidth, height: genHeight, prompt, model: settings.aiProvider?.model ?? '', seed: generationResult.seed },
      });

      if (projectId) markDirty();

      const cloudSaved = isAuthenticated && !!result.assetId;
      log('generation_complete', `Generated: ${filename}${cloudSaved ? ' (saved to cloud)' : ''}`, { prompt, filename, seed: generationResult.seed, assetId: result.assetId });

      if (settings.autoSavePrompts) {
        log('prompt_save', `Saved prompt: "${prompt.slice(0, 30)}…"`, { prompt });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      failJob(job.id, message);
      log('generation_fail', `Generation failed: ${message}`, { error: message });
    }
  }, [prompt, negativePrompt, genWidth, genHeight, localApiKey, settings, isAuthenticated, projectId, startGeneration, completeJob, failJob, addItem, addAsset, updateAIProvider, markDirty, log]);

  const handleUpdatePosition = useCallback(
    (axis: 'x' | 'y', value: number) => {
      if (selectedItem) updateItem(selectedItem.id, { [axis]: value });
    },
    [selectedItem, updateItem],
  );

  const handleRenameItem = useCallback(
    (name: string) => {
      if (selectedItem) {
        updateItem(selectedItem.id, { name });
        if (selectedItem.assetId) {
          updateAsset(selectedItem.assetId, { name });
        }
      }
    },
    [selectedItem, updateItem, updateAsset],
  );

  const recentJobs = jobs.slice(0, 5);
  const currentModel = settings.aiProvider?.model || 'imagen-3.0-generate-002';
  const hasApiKey = !!localApiKey;

  return (
    <aside className={styles.inspector} style={{ width }}>
      <div className={styles.header}>
        <h2 className={styles.title}>Inspector</h2>
        <button 
          className={styles.toggleButton} 
          onClick={onToggle}
          title="Toggle Inspector (⌘3)"
        >
          <PanelRight size={16} />
        </button>
      </div>

      <div className={styles.content}>
        {/* Generate - Main Content */}
        <div className={styles.mainGenerator}>
          <div className={styles.formGroup} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className={styles.promptHeader}>
              <label className={styles.promptLabel}>Prompt</label>
              <button 
                className={styles.templateToggle} 
                onClick={() => setShowTemplates(!showTemplates)}
                title={showTemplates ? "Hide Templates" : "Show Templates"}
              >
                <BookOpen size={10} />
                TEMPLATES
              </button>
            </div>
            {showTemplates && (
              <div className={styles.templateSection}>
                <PromptTemplatesSection onUse={(t) => { setPrompt(t); setShowTemplates(false); }} isAuthenticated={isAuthenticated} />
              </div>
            )}
            <Textarea
              placeholder="Describe the image you want to create…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              wrapperClassName={styles.promptInputWrapper}
            />
          </div>

          <div className={styles.formGroup}>
            <div className={styles.negativePromptHeader} onClick={() => setShowNegativePrompt(!showNegativePrompt)}>
              {showNegativePrompt ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <label className={styles.negativePromptLabel}>Negative Prompt (Optional)</label>
              {showNegativePrompt && (
                <button 
                  className={styles.templateToggle} 
                  onClick={(e) => { e.stopPropagation(); setShowNegativeTemplates(!showNegativeTemplates); }}
                  title="Show Templates"
                >
                  <BookOpen size={10} />
                  TEMPLATES
                </button>
              )}
            </div>
            
            {showNegativePrompt && (
              <>
                {showNegativeTemplates && (
                  <div className={styles.templateSection}>
                    <PromptTemplatesSection onUse={(t) => { setNegativePrompt(t); setShowNegativeTemplates(false); }} isAuthenticated={isAuthenticated} />
                  </div>
                )}
                <Textarea
                  placeholder="What to avoid…"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  rows={2}
                />
              </>
            )}
          </div>

          <div className={styles.generateGroup}>
            <div className={styles.modelSelector} ref={dropdownRef}>
              <button 
                className={styles.modelButton}
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                disabled={!hasApiKey}
                title={hasApiKey ? `Current Model: ${currentModel}` : 'Enter API Key to select model'}
              >
                {(settings.aiProvider?.provider === 'nanobanana' || currentModel.includes('banana')) ? <BananaIcon /> : <Sparkles size={16} />}
                <ChevronDown size={12} />
              </button>
              
              {showModelDropdown && (
                <div className={styles.modelDropdown}>
                  {RECOMMENDED_GENERATION_MODELS.map((model) => (
                    <button
                      key={model}
                      className={`${styles.modelOption} ${currentModel === model ? styles.active : ''}`}
                      onClick={() => {
                        updateAIProvider({ model });
                        setShowModelDropdown(false);
                      }}
                    >
                      {model}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              variant="primary"
              className={styles.generateButton}
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating || !hasApiKey}
              loading={isGenerating}
              icon={<Sparkles size={16} />}
            >
              {isGenerating ? 'Generating…' : 'Generate'}
            </Button>
          </div>

          {isAuthenticated && (
            <p className={styles.hint} style={{ marginTop: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Cloud size={10} style={{ color: 'var(--success-solid)' }} />
              Images saved to your account
            </p>
          )}
        </div>

        {/* Selected Item */}
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
                <span className={styles.propertyLabel}>Position</span>
                <span className={styles.propertyValue}>{Math.round(selectedItem.x)}, {Math.round(selectedItem.y)}</span>
              </div>
              <div className={styles.property}>
                <span className={styles.propertyLabel}>Size</span>
                <span className={styles.propertyValue}>{Math.round(selectedItem.width * selectedItem.scale)} × {Math.round(selectedItem.height * selectedItem.scale)}</span>
              </div>
              {selectedItem.rotation !== 0 && (
                <div className={styles.property}>
                  <span className={styles.propertyLabel}>Rotation</span>
                  <span className={styles.propertyValue}>{selectedItem.rotation}°</span>
                </div>
              )}
              {selectedItem.assetId && (
                <div className={styles.property}>
                  <span className={styles.propertyLabel}>Cloud ID</span>
                  <span className={styles.propertyValue} style={{ fontSize: '0.625rem', opacity: 0.6 }}>
                    {selectedItem.assetId.slice(0, 14)}…
                  </span>
                </div>
              )}
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

        {/* Version History */}
        {projectId && isAuthenticated && (
          <CollapsibleSection title="Version History" icon={<History size={14} />} defaultOpen={false}>
            <VersionHistorySection projectId={projectId} />
          </CollapsibleSection>
        )}

        {/* Recent Generations */}
        {recentJobs.length > 0 && (
          <CollapsibleSection title="Recent Generations" icon={<History size={14} />} defaultOpen={false} badge={recentJobs.length}>
            <div className={styles.jobList}>
              {recentJobs.map((job) => (
                <div key={job.id} className={styles.jobItem}>
                  <div className={styles.jobStatus}>
                    <span className={`${styles.statusDot} ${styles[job.status]}`} />
                    <span className={styles.jobPrompt}>{job.request.prompt.slice(0, 40)}…</span>
                  </div>
                  {job.result?.dataUrl && (
                    <img src={job.result.dataUrl} alt="" className={styles.jobThumb} />
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
