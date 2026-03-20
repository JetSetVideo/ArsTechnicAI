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
  Trash2,
  Copy,
  Lock,
  Plus,
  GitBranch,
  Users,
  Layers,
  Film,
  Headphones,
  FileText,
  Eye,
  HardDrive,
  FolderOpen,
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
  useToastStore,
} from '@/stores';
import { RECOMMENDED_GENERATION_MODELS } from '@/stores/settingsStore';
import type { GenerationResult, GenerationMeta } from '@/types';
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

// ─── Agent Personas ───────────────────────────────────────────────────────────
interface AgentPersona {
  id: string;
  label: string;
  icon: React.ReactNode;
  role: string;
  enhancer: (prompt: string) => string;
}

const AGENT_PERSONAS: AgentPersona[] = [
  {
    id: 'designer',
    label: 'Designer',
    icon: <Palette size={10} />,
    role: 'Visual Designer',
    enhancer: (p) =>
      `${p}, professional visual design, harmonious color palette, balanced composition, refined typography hierarchy, clean whitespace, elegant layout with golden ratio proportions, premium aesthetic quality`,
  },
  {
    id: 'architect',
    label: 'Architect',
    icon: <Cpu size={10} />,
    role: 'Software Architect',
    enhancer: (p) =>
      `${p}, structured modular layout, clear visual hierarchy, systematic grid-based design, scalable component architecture, consistent design tokens, organized information flow`,
  },
  {
    id: 'tester',
    label: 'UX Tester',
    icon: <BookOpen size={10} />,
    role: 'User Experience Tester',
    enhancer: (p) =>
      `${p}, high usability, intuitive navigation, accessible contrast ratios, clear call-to-action elements, readable font sizes, mobile-friendly responsive design, inclusive design principles`,
  },
  {
    id: 'optimizer',
    label: 'Optimizer',
    icon: <Sparkles size={10} />,
    role: 'Performance Optimizer',
    enhancer: (p) =>
      `${p}, optimized visual weight, efficient use of negative space, minimal visual clutter, fast visual parsing, focused attention hierarchy, reduced cognitive load, sharp crisp details`,
  },
];

const AgentPersonaBar: React.FC<{
  onApply: (enhanced: string) => void;
  currentPrompt: string;
}> = ({ onApply, currentPrompt }) => {
  const [activeAgents, setActiveAgents] = useState<Set<string>>(new Set());

  const toggleAgent = useCallback(
    (id: string) => {
      setActiveAgents((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [],
  );

  const applyAgents = useCallback(() => {
    if (activeAgents.size === 0 || !currentPrompt.trim()) return;
    let enhanced = currentPrompt.trim();
    for (const persona of AGENT_PERSONAS) {
      if (activeAgents.has(persona.id)) {
        enhanced = persona.enhancer(enhanced);
      }
    }
    onApply(enhanced);
  }, [activeAgents, currentPrompt, onApply]);

  return (
    <div style={{ marginBottom: 'var(--space-2, 0.5rem)' }}>
      <div className={styles.agentLabel}>Agent Personas</div>
      <div className={styles.agentBar}>
        {AGENT_PERSONAS.map((a) => (
          <button
            key={a.id}
            className={`${styles.agentChip} ${activeAgents.has(a.id) ? styles.agentChipActive : ''}`}
            onClick={() => toggleAgent(a.id)}
            title={a.role}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
        {activeAgents.size > 0 && currentPrompt.trim() && (
          <button
            className={`${styles.agentChip} ${styles.agentChipActive}`}
            onClick={applyAgents}
            title="Apply selected agent enhancements to prompt"
            style={{ marginLeft: 'auto' }}
          >
            Apply
          </button>
        )}
      </div>
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

// ─── Tag config & helpers ─────────────────────────────────────────────────────
const TAG_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  generated: { label: 'Generated', color: '#00d4aa', bg: 'rgba(0,212,170,0.12)', border: 'rgba(0,212,170,0.4)', icon: <Sparkles size={10} /> },
  image: { label: 'Image', color: '#a855f7', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.4)', icon: <Palette size={10} /> },
  video: { label: 'Video', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.4)', icon: <Film size={10} /> },
  audio: { label: 'Audio', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)', icon: <Headphones size={10} /> },
  text: { label: 'Text', color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.4)', icon: <FileText size={10} /> },
  placeholder: { label: 'Placeholder', color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.4)', icon: <Layers size={10} /> },
};

const SIZE_PRESETS: { label: string; w: number; h: number; color: string }[] = [
  { label: '512 × 512', w: 512, h: 512, color: 'var(--accent-primary)' },
  { label: '768 × 768', w: 768, h: 768, color: '#a855f7' },
  { label: '1024 × 1024', w: 1024, h: 1024, color: '#3b82f6' },
  { label: '1024 × 1792', w: 1024, h: 1792, color: '#f59e0b' },
  { label: '1792 × 1024', w: 1792, h: 1024, color: '#ef4444' },
  { label: '2048 × 2048', w: 2048, h: 2048, color: '#ec4899' },
];

const formatRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
};

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
};

const formatDuration = (seconds: number): string => {
  if (!seconds || !isFinite(seconds)) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// ─── Main InspectorPanel ──────────────────────────────────────────────────────
export const InspectorPanel: React.FC<InspectorPanelProps> = ({ width, onOpenSettings, onToggle }) => {
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === 'authenticated' && !!session?.user;

  const {
    prompt, setPrompt, negativePrompt, setNegativePrompt,
    width: genWidth, height: genHeight, setDimensions,
    isGenerating, startGeneration, completeJob, failJob, jobs,
  } = useGenerationStore();

  const { updateItem, addItem, removeSelected, copy, paste } = useCanvasStore();
  const allItems = useCanvasStore((s) => s.items);
  const { updateAsset, addAsset, addAssetToFolder, getProjectGeneratedPath, getAsset } = useFileStore();
  const settings = useSettingsStore((s) => s.settings);
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
  /** Active header tab */
  const [activeTab, setActiveTab] = useState<'inspector' | 'prompt'>('prompt');
  /** Multi-select type filter */
  const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null);
  /** Size panel expanded */
  const [showSizePanel, setShowSizePanel] = useState(false);

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

  const toast = useToastStore();

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.warning('Prompt Required', 'Please describe the image you want to generate.');
      return;
    }

    if (localApiKey !== settings.aiProvider?.apiKey) {
      updateAIProvider({ apiKey: localApiKey });
    }

    if (!localApiKey) {
      toast.error('API Key Required', 'Please enter your API key in Settings (API Keys tab).');
      return;
    }

    const currentModel = settings.aiProvider?.model ?? 'imagen-3.0-generate-002';

    log('generation_start', `Started generating: "${prompt.slice(0, 50)}…"`, { prompt, width: genWidth, height: genHeight });
    toast.info('Generation Started', `Creating: "${prompt.slice(0, 50)}${prompt.length > 50 ? '…' : ''}"`, 3000);

    const job = startGeneration({ prompt, negativePrompt, width: genWidth, height: genHeight, model: currentModel });

    try {
      const body: Record<string, unknown> = {
        prompt, negativePrompt, width: genWidth, height: genHeight, apiKey: localApiKey, model: currentModel,
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

      const genSeed = result.seed || Math.floor(Math.random() * 1000000);
      const genId = uuidv4();
      const now = Date.now();

      const generationResult: GenerationResult = {
        id: genId,
        prompt,
        imageUrl: result.imageUrl || '',
        dataUrl: result.dataUrl,
        width: genWidth,
        height: genHeight,
        model: currentModel,
        seed: genSeed,
        createdAt: now,
      };

      completeJob(job.id, generationResult);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const promptSlug = prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
      const filename = `gen_${promptSlug}_${timestamp}.png`;

      const generationMeta: GenerationMeta = {
        prompt,
        negativePrompt: negativePrompt || undefined,
        model: currentModel,
        seed: genSeed,
        width: genWidth,
        height: genHeight,
        generatedAt: now,
        filePath: result.filePath || `/generated/${filename}`,
        parentIds: [],
        childIds: [],
        imageVersion: 1,
        variations: [],
      };

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
        generationMeta,
      });

      const assetId = result.assetId ?? genId;
      const generatedFolderPath = getProjectGeneratedPath();

      addAssetToFolder(
        {
          id: assetId,
          name: filename,
          type: 'image',
          path: `${generatedFolderPath}/${filename}`,
          createdAt: now,
          modifiedAt: now,
          thumbnail: result.dataUrl || result.imageUrl,
          metadata: {
            width: genWidth,
            height: genHeight,
            prompt,
            model: currentModel,
            seed: genSeed,
          },
        },
        generatedFolderPath,
      );

      // Persist generation metadata to JSON
      fetch('/api/generations/save-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: genId,
          prompt,
          negativePrompt: negativePrompt || undefined,
          model: currentModel,
          seed: genSeed,
          width: genWidth,
          height: genHeight,
          generatedAt: now,
          filePath: result.filePath || `/generated/${filename}`,
          parentIds: [],
          childIds: [],
          imageVersion: 1,
          variations: [],
        }),
      }).catch(() => {});

      if (projectId) markDirty();

      const cloudSaved = isAuthenticated && !!result.assetId;
      log('generation_complete', `Generated: ${filename}${cloudSaved ? ' (saved to cloud)' : ''}`, { prompt, filename, seed: genSeed, assetId: result.assetId });

      toast.success('Image Generated', `Saved as ${filename}`, 5000);

      if (settings.autoSavePrompts) {
        log('prompt_save', `Saved prompt: "${prompt.slice(0, 30)}…"`, { prompt });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      failJob(job.id, message);
      log('generation_fail', `Generation failed: ${message}`, { error: message });
      toast.error('Generation Failed', message, 8000);
    }
  }, [prompt, negativePrompt, genWidth, genHeight, localApiKey, settings, isAuthenticated, projectId, startGeneration, completeJob, failJob, addItem, addAssetToFolder, getProjectGeneratedPath, updateAIProvider, markDirty, log, toast]);

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
        <div className={styles.headerTitleRow}>
          <div className={styles.tabBar}>
            <button
              className={`${styles.tabButton} ${activeTab === 'inspector' ? styles.tabButtonActive : ''}`}
              onClick={() => setActiveTab('inspector')}
            >
              <Palette size={12} />
              Inspector
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'prompt' ? styles.tabButtonActive : ''}`}
              onClick={() => setActiveTab('prompt')}
            >
              <Sparkles size={12} />
              Prompt
            </button>
          </div>
          <button
            className={styles.toggleButton}
            onClick={onToggle}
            title="Toggle Inspector (⌘3)"
          >
            <PanelRight size={16} />
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {/* ─── INSPECTOR TAB ─── */}
        {activeTab === 'inspector' && (
          <div className={styles.tabContent}>
            {/* Empty state */}
            {selectedItems.length === 0 && (
              <div className={styles.emptyInspector}>
                <Palette size={28} />
                <p>Select an item on the canvas to inspect its properties.</p>
              </div>
            )}

            {/* ── Single item view ── */}
            {selectedItems.length === 1 && selectedItem && (() => {
              const tagCfg = TAG_CONFIG[selectedItem.type] || TAG_CONFIG.placeholder;
              const promptText = selectedItem.generationMeta?.prompt || selectedItem.prompt;
              const meta = selectedItem.generationMeta;
              const mm = selectedItem.mediaMeta;
              const linkedAsset = selectedItem.assetId ? getAsset(selectedItem.assetId) : undefined;
              const assetMeta = linkedAsset?.metadata;
              const parentIds = meta?.parentIds ?? [];
              const childIds = meta?.childIds ?? [];
              const variations = meta?.variations ?? [];
              const versionCount = meta?.imageVersion ?? 1;
              const parentItems = allItems.filter((i) => parentIds.includes(i.id) || (selectedItem.parentAssetId && i.assetId === selectedItem.parentAssetId));
              const childItems = allItems.filter((i) => childIds.includes(i.id) || i.parentAssetId === selectedItem.assetId);
              const curW = Math.round(selectedItem.width * selectedItem.scale);
              const curH = Math.round(selectedItem.height * selectedItem.scale);
              const curSizeLabel = `${curW} × ${curH}`;

              const mimeType = mm?.mimeType || assetMeta?.mimeType || '';
              const fileSize = mm?.fileSize || assetMeta?.fileSize || linkedAsset?.size || 0;
              const duration = mm?.duration || assetMeta?.duration || 0;
              const fps = mm?.fps || assetMeta?.fps;
              const codec = mm?.codec || assetMeta?.codec;
              const channels = mm?.channels || assetMeta?.channels;
              const sampleRate = mm?.sampleRate || assetMeta?.sampleRate;
              const bitRate = mm?.bitRate || assetMeta?.bitRate;
              const source = mm?.source || assetMeta?.source;
              const usageCount = assetMeta?.usageCount || 0;
              const variationIds = assetMeta?.variationIds || [];
              const childAssetIds = assetMeta?.childAssetIds || [];
              const projectIds = assetMeta?.projectIds || [];
              const isVideo = selectedItem.type === 'video';
              const isAudio = selectedItem.type === 'audio';
              const isText = selectedItem.type === 'text';
              const filmstripFrames = mm?.filmstripFrames || [];

              return (
                <div className={styles.selectedInContent}>
                  <div className={styles.nameInputRow}>
                    <Input
                      label="Name"
                      value={selectedItem.name}
                      onChange={(e) => handleRenameItem(e.target.value)}
                      placeholder="Item name..."
                    />
                  </div>

                  <div className={styles.selectedPreview}>
                    {selectedItem.src ? (
                      <img src={selectedItem.src} alt="" className={styles.selectedPreviewImg} />
                    ) : (
                      <div className={styles.selectedPreviewPlaceholder}>
                        {tagCfg.icon}
                        <span>No preview</span>
                      </div>
                    )}
                    {/* Duration overlay for video/audio */}
                    {duration > 0 && (
                      <span className={styles.previewDuration}>{formatDuration(duration)}</span>
                    )}
                  </div>

                  {/* Filmstrip for video */}
                  {isVideo && filmstripFrames.length > 0 && (
                    <div className={styles.filmstrip}>
                      {filmstripFrames.map((frame, i) => (
                        <img key={i} src={frame} alt={`Frame ${i + 1}`} className={styles.filmstripFrame} />
                      ))}
                    </div>
                  )}

                  {/* ── Format & Media Info Card ── */}
                  <div className={styles.mediaInfoCard}>
                    <div className={styles.mediaInfoHeader}>
                      <span className={styles.mediaInfoIcon} style={{ color: tagCfg.color }}>
                        {tagCfg.icon}
                      </span>
                      <span className={styles.mediaInfoType} style={{ color: tagCfg.color }}>
                        {tagCfg.label}
                      </span>
                      {mimeType && (
                        <span className={styles.mediaInfoMime}>{mimeType}</span>
                      )}
                    </div>
                    <div className={styles.mediaInfoGrid}>
                      {curW > 0 && curH > 0 && (
                        <div className={styles.mediaInfoItem}>
                          <span className={styles.mediaInfoLabel}>Resolution</span>
                          <span className={styles.mediaInfoValue}>{curW} × {curH}</span>
                        </div>
                      )}
                      {fileSize > 0 && (
                        <div className={styles.mediaInfoItem}>
                          <span className={styles.mediaInfoLabel}>Size</span>
                          <span className={styles.mediaInfoValue}>{formatFileSize(fileSize)}</span>
                        </div>
                      )}
                      {duration > 0 && (
                        <div className={styles.mediaInfoItem}>
                          <span className={styles.mediaInfoLabel}>Duration</span>
                          <span className={styles.mediaInfoValue}>{formatDuration(duration)}</span>
                        </div>
                      )}
                      {fps != null && fps > 0 && (
                        <div className={styles.mediaInfoItem}>
                          <span className={styles.mediaInfoLabel}>FPS</span>
                          <span className={styles.mediaInfoValue}>{fps}</span>
                        </div>
                      )}
                      {codec && (
                        <div className={styles.mediaInfoItem}>
                          <span className={styles.mediaInfoLabel}>Codec</span>
                          <span className={styles.mediaInfoValue}>{codec}</span>
                        </div>
                      )}
                      {bitRate != null && bitRate > 0 && (
                        <div className={styles.mediaInfoItem}>
                          <span className={styles.mediaInfoLabel}>Bit Rate</span>
                          <span className={styles.mediaInfoValue}>{formatFileSize(bitRate)}/s</span>
                        </div>
                      )}
                      {channels != null && channels > 0 && (
                        <div className={styles.mediaInfoItem}>
                          <span className={styles.mediaInfoLabel}>Channels</span>
                          <span className={styles.mediaInfoValue}>{channels === 1 ? 'Mono' : channels === 2 ? 'Stereo' : `${channels}ch`}</span>
                        </div>
                      )}
                      {sampleRate != null && sampleRate > 0 && (
                        <div className={styles.mediaInfoItem}>
                          <span className={styles.mediaInfoLabel}>Sample Rate</span>
                          <span className={styles.mediaInfoValue}>{(sampleRate / 1000).toFixed(1)} kHz</span>
                        </div>
                      )}
                      {source && (
                        <div className={styles.mediaInfoItem}>
                          <span className={styles.mediaInfoLabel}>Source</span>
                          <span className={styles.mediaInfoValue} style={{ textTransform: 'capitalize' }}>{source}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.propertyGrid}>
                    <div className={styles.positionRow}>
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
                      <div className={styles.formGroup}>
                        <Input
                          label="Z"
                          type="number"
                          value={selectedItem.zIndex}
                          onChange={(e) => updateItem(selectedItem.id, { zIndex: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>

                    {/* ── Size (expandable) ── */}
                    <button
                      className={styles.sizeButton}
                      onClick={() => setShowSizePanel(!showSizePanel)}
                    >
                      <span className={styles.propertyLabel}>Size</span>
                      <span className={styles.propertyValue}>{curSizeLabel}</span>
                      {showSizePanel ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    </button>
                    {showSizePanel && (
                      <div className={styles.sizePanel}>
                        {SIZE_PRESETS.map((preset) => {
                          const isActive = curW === preset.w && curH === preset.h;
                          return (
                            <button
                              key={preset.label}
                              className={`${styles.sizeOption} ${isActive ? styles.sizeOptionActive : ''}`}
                              style={{ ['--size-color' as string]: preset.color }}
                              onClick={() => {
                                updateItem(selectedItem.id, { width: preset.w, height: preset.h, scale: 1 });
                              }}
                            >
                              <span
                                className={styles.sizeOptionDot}
                                style={{ background: preset.color }}
                              />
                              {preset.label}
                            </button>
                          );
                        })}
                        {variations.length > 0 && (
                          <>
                            <div className={styles.sizeDivider} />
                            <div className={styles.sizeSectionLabel}>Existing variations</div>
                            {variations.map((v) => (
                              <div key={v.id} className={styles.sizeOption} style={{ cursor: 'default' }}>
                                <span className={styles.sizeOptionDot} style={{ background: 'var(--text-muted)' }} />
                                {v.label}
                              </div>
                            ))}
                          </>
                        )}
                        <button
                          className={styles.sizeAddButton}
                          onClick={() => {
                            const newW = curW;
                            const newH = curH;
                            const newVariation = { id: `var-${Date.now()}`, label: `${newW}×${newH} variant` };
                            const updatedVariations = [...variations, newVariation];
                            updateItem(selectedItem.id, {
                              generationMeta: { ...(meta || { prompt: '', model: '', seed: 0, width: newW, height: newH, generatedAt: Date.now() }), variations: updatedVariations },
                            });
                            log('canvas_resize', `Added size variation ${newW}×${newH}`);
                          }}
                        >
                          <Plus size={10} />
                          Add current size as variation
                        </button>
                      </div>
                    )}

                    {selectedItem.rotation !== 0 && (
                      <div className={styles.property}>
                        <span className={styles.propertyLabel}>Rotation</span>
                        <span className={styles.propertyValue}>{selectedItem.rotation}°</span>
                      </div>
                    )}

                    {promptText && (
                      <div
                        className={styles.promptDisplay}
                        style={{ borderLeftColor: tagCfg.color }}
                      >
                        {promptText}
                      </div>
                    )}

                    {/* ── Usage & Tracking ── */}
                    <div className={styles.metaRow}>
                      <div className={`${styles.metaChip} ${usageCount > 0 ? '' : styles.metaChipMuted}`}>
                        <Eye size={10} />
                        <span>{usageCount} use{usageCount !== 1 ? 's' : ''}</span>
                      </div>
                      <div className={`${styles.metaChip} ${versionCount > 1 ? '' : styles.metaChipMuted}`}>
                        <GitBranch size={10} />
                        <span>v{versionCount}</span>
                        {(variations.length > 0 || variationIds.length > 0) && (
                          <span className={styles.metaChipBadge}>{variations.length + variationIds.length} var</span>
                        )}
                      </div>
                    </div>
                    <div className={styles.metaRow}>
                      <div className={`${styles.metaChip} ${parentItems.length > 0 ? '' : styles.metaChipMuted}`}>
                        <Users size={10} />
                        <span>{parentItems.length > 0 ? `${parentItems.length} parent${parentItems.length > 1 ? 's' : ''}` : 'No parents'}</span>
                      </div>
                      <div className={`${styles.metaChip} ${(childItems.length + childAssetIds.length) > 0 ? '' : styles.metaChipMuted}`}>
                        <Layers size={10} />
                        <span>{(childItems.length + childAssetIds.length) > 0 ? `${childItems.length + childAssetIds.length} child${(childItems.length + childAssetIds.length) > 1 ? 'ren' : ''}` : 'No children'}</span>
                      </div>
                    </div>

                    {/* ── Projects ── */}
                    {projectIds.length > 0 && (
                      <div className={styles.projectsRow}>
                        <FolderOpen size={10} />
                        <span className={styles.projectsLabel}>In {projectIds.length} project{projectIds.length > 1 ? 's' : ''}</span>
                      </div>
                    )}

                    {/* ── Footer: tag + timestamps ── */}
                    <div className={styles.inspectorFooter}>
                      <span
                        className={styles.itemTag}
                        style={{ background: tagCfg.bg, color: tagCfg.color, borderColor: tagCfg.border }}
                      >
                        {tagCfg.icon}
                        {tagCfg.label}
                      </span>
                      {selectedItem.generationMeta?.model && (
                        <span className={styles.itemTagMuted} title="Model">
                          {selectedItem.generationMeta.model}
                        </span>
                      )}
                      <span className={styles.footerTimestamp}>
                        {selectedItem.createdAt != null && (
                          <>{new Date(selectedItem.createdAt).toLocaleDateString()}</>
                        )}
                        {selectedItem.updatedAt != null && (
                          <> · edited {formatRelativeTime(selectedItem.updatedAt)}</>
                        )}
                        {selectedItem.createdAt != null && !selectedItem.updatedAt && (
                          <> · {formatRelativeTime(selectedItem.createdAt)}</>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Multi-selection view ── */}
            {selectedItems.length > 1 && (() => {
              const typeCounts = selectedItems.reduce<Record<string, number>>((acc, item) => {
                acc[item.type] = (acc[item.type] || 0) + 1;
                return acc;
              }, {});
              const filtered = activeTypeFilter
                ? selectedItems.filter((i) => i.type === activeTypeFilter)
                : selectedItems;
              const minX = Math.min(...filtered.map((i) => i.x));
              const minY = Math.min(...filtered.map((i) => i.y));
              const maxX = Math.max(...filtered.map((i) => i.x + i.width * i.scale));
              const maxY = Math.max(...filtered.map((i) => i.y + i.height * i.scale));
              const avgX = Math.round(filtered.reduce((s, i) => s + i.x, 0) / filtered.length);
              const avgY = Math.round(filtered.reduce((s, i) => s + i.y, 0) / filtered.length);

              return (
                <div className={styles.selectedInContent}>
                  <div className={styles.multiSelectHeader}>
                    {selectedItems.length} items selected
                  </div>

                  <div className={styles.filterChips}>
                    {Object.entries(typeCounts).map(([type, count]) => {
                      const cfg = TAG_CONFIG[type] || TAG_CONFIG.placeholder;
                      const isActive = activeTypeFilter === null || activeTypeFilter === type;
                      return (
                        <button
                          key={type}
                          className={`${styles.filterChip} ${!isActive ? styles.filterChipInactive : ''}`}
                          style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}
                          onClick={() => setActiveTypeFilter(activeTypeFilter === type ? null : type)}
                        >
                          {cfg.label} ({count})
                        </button>
                      );
                    })}
                  </div>

                  <div className={styles.multiStats}>
                    <div className={styles.statRow}>
                      <span>Total items</span>
                      <span className={styles.statValue}>{filtered.length}</span>
                    </div>
                    <div className={styles.statRow}>
                      <span>Types</span>
                      <span className={styles.statValue}>
                        {Object.entries(typeCounts).map(([t, c]) => `${TAG_CONFIG[t]?.label || t} (${c})`).join(', ')}
                      </span>
                    </div>
                    <div className={styles.statRow}>
                      <span>Bounding box</span>
                      <span className={styles.statValue}>
                        {Math.round(maxX - minX)} × {Math.round(maxY - minY)}
                      </span>
                    </div>
                    <div className={styles.statRow}>
                      <span>Avg. position</span>
                      <span className={styles.statValue}>{avgX}, {avgY}</span>
                    </div>
                  </div>

                  <div className={styles.thumbnailStrip}>
                    {selectedItems.map((item) =>
                      item.src ? (
                        <img
                          key={item.id}
                          src={item.src}
                          alt={item.name}
                          className={styles.thumbnailMini}
                          title={item.name}
                        />
                      ) : (
                        <div
                          key={item.id}
                          className={styles.thumbnailMini}
                          title={item.name}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)' }}
                        >
                          <Palette size={16} />
                        </div>
                      ),
                    )}
                  </div>

                  <div className={styles.bulkActions}>
                    <button className={styles.bulkAction} onClick={() => removeSelected()}>
                      <Trash2 size={10} /> Delete
                    </button>
                    <button className={styles.bulkAction} onClick={() => { copy(); paste(); }}>
                      <Copy size={10} /> Duplicate
                    </button>
                    <button
                      className={styles.bulkAction}
                      onClick={() => {
                        selectedItems.forEach((item) => updateItem(item.id, { locked: !item.locked }));
                      }}
                    >
                      <Lock size={10} /> {selectedItems.every((i) => i.locked) ? 'Unlock' : 'Lock'}
                    </button>
                  </div>
                </div>
              );
            })()}

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
        )}

        {/* ─── PROMPT TAB ─── */}
        {activeTab === 'prompt' && (
          <div className={styles.mainGenerator}>
            <div className={styles.formGroup} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className={styles.promptHeader}>
                <label className={styles.promptLabel}>Prompt</label>
                <button
                  className={styles.templateToggle}
                  onClick={() => setShowTemplates(!showTemplates)}
                  title={showTemplates ? 'Hide Templates' : 'Show Templates'}
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

            {/* Agent Personas */}
            <AgentPersonaBar
              onApply={(enhanced) => setPrompt(enhanced)}
              currentPrompt={prompt}
            />

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
        )}
      </div>
    </aside>
  );
};
