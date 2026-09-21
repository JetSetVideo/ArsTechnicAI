import React, { useCallback, useState } from 'react';
import {
  X, Dices, Upload, Play, Loader2, Trash2, SlidersHorizontal,
  Layers as LayersIcon, Info, Maximize2, GitCommitVertical, ChevronRight, Wand2,
} from 'lucide-react';
import type { ParamDef, PipelineNode } from '@/types/pipeline';
import { PIPELINE_NODE_DEFS, STAGES } from '@/lib/pipeline/catalog';
import { usePipelineStore } from '@/stores/pipelineStore';
import { nodeIcon } from './PipelineNodeCard';
import { LayersPanelBody, VariantInfoBody, activeVariantOf } from './LayerSystem';
import { RetouchPanel } from './RetouchPanel';
import styles from './WorkshopFlow.module.css';

interface Props {
  node: PipelineNode;
  apiKey: string;
}

const FieldWidget: React.FC<{
  param: ParamDef;
  value: unknown;
  onChange: (value: unknown) => void;
  onImportFile?: (dataUrl: string, name: string) => void;
}> = ({ param, value, onChange, onImportFile }) => {
  const fileRef = React.useRef<HTMLInputElement>(null);

  switch (param.widget) {
    case 'textarea':
      return (
        <textarea
          className={styles.textarea}
          value={(value as string) ?? ''}
          placeholder={param.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'number':
    case 'duration':
      return (
        <input
          type="number"
          className={styles.input}
          value={(value as number) ?? 0}
          min={param.min}
          max={param.max}
          step={param.step ?? 1}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      );
    case 'slider':
      return (
        <div className={styles.sliderRow}>
          <input
            type="range"
            className={styles.slider}
            value={(value as number) ?? (param.default as number) ?? 0}
            min={param.min ?? 0}
            max={param.max ?? 1}
            step={param.step ?? 0.05}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span className={styles.sliderValue}>{String(value ?? param.default ?? 0)}</span>
        </div>
      );
    case 'select':
    case 'aspect':
      return (
        <select
          className={styles.selectInput}
          value={(value as string) ?? (param.default as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          {(param.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    case 'multiselect': {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className={styles.checkList}>
          {(param.options ?? []).map((o) => (
            <label key={o.value} className={styles.checkItem}>
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, o.value]
                      : selected.filter((s) => s !== o.value)
                  )
                }
              />
              {o.label}
            </label>
          ))}
        </div>
      );
    }
    case 'toggle':
      return (
        <button
          type="button"
          className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}
          onClick={() => onChange(!value)}
          aria-pressed={Boolean(value)}
        >
          <span className={styles.toggleKnob} />
        </button>
      );
    case 'color':
      return (
        <div className={styles.colorRow}>
          <input
            type="color"
            className={styles.colorInput}
            value={(value as string) ?? (param.default as string) ?? '#ffffff'}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className={styles.sliderValue}>{String(value ?? param.default ?? '')}</span>
        </div>
      );
    case 'seed':
      return (
        <div className={styles.seedRow}>
          <input
            type="number"
            className={styles.input}
            value={(value as number) ?? -1}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <button
            type="button"
            className={styles.diceBtn}
            title="Random seed"
            onClick={() => onChange(Math.floor(Math.random() * 1e9))}
          >
            <Dices size={13} />
          </button>
        </div>
      );
    case 'file':
      return (
        <>
          <div className={styles.fileDrop} onClick={() => fileRef.current?.click()}>
            <Upload size={15} />
            <span>{typeof value === 'string' && value ? 'Replace file' : 'Click to choose a file'}</span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*,audio/*,.srt,.vtt,.md,.txt,.json,.glb,.gltf,.obj,.ply"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result as string;
                onChange(dataUrl);
                onImportFile?.(dataUrl, file.name);
              };
              reader.readAsDataURL(file);
              e.target.value = '';
            }}
          />
        </>
      );
    case 'tags':
      return (
        <input
          className={styles.input}
          value={Array.isArray(value) ? (value as string[]).join(', ') : (value as string) ?? ''}
          placeholder="comma, separated, tags"
          onChange={(e) => onChange(e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
        />
      );
    default:
      return (
        <input
          className={styles.input}
          value={(value as string) ?? ''}
          placeholder={param.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
};

export const NodeInspector: React.FC<Props> = ({ node, apiKey }) => {
  const def = PIPELINE_NODE_DEFS[node.type];
  // Only `paramTemplates` needs to be a reactive subscription (it drives
  // `nodeTemplates` below) — the rest are stable action functions (zustand
  // never changes their reference), so reading them via getState() instead
  // of destructuring the whole store avoids re-rendering this Inspector on
  // every unrelated pipeline change (e.g. another node finishing a run).
  const paramTemplates = usePipelineStore((s) => s.paramTemplates);
  const {
    setParam, select, renameNode, runNode, removeNode, addVariant,
    openEditor, selectVariant, saveTemplate, applyTemplate,
  } = usePipelineStore.getState();
  const [templateName, setTemplateName] = useState('');
  const nodeTemplates = paramTemplates.filter((t) => t.nodeType === node.type);
  const stage = STAGES[node.stage];
  const isRunning = node.status === 'running';
  const [tab, setTab] = useState<'params' | 'retouch' | 'layers' | 'info'>('params');
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  // Accordion: first section open, the rest collapsed — long forms stay scannable
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const variant = activeVariantOf(node);

  const handleImportFile = useCallback((dataUrl: string, name: string) => {
    const isImage = dataUrl.startsWith('data:image');
    addVariant(node.id, {
      label: name,
      image: isImage ? dataUrl : undefined,
      text: isImage ? undefined : `Imported: ${name}`,
      meta: { imported: true, name },
    });
  }, [node.id, addVariant]);

  if (!def) return null;

  // Group params by section, preserving catalog order
  const sections: { title: string; params: ParamDef[] }[] = [];
  for (const p of def.params) {
    const title = p.section ?? 'Settings';
    const existing = sections.find((s) => s.title === title);
    if (existing) existing.params.push(p);
    else sections.push({ title, params: [p] });
  }

  return (
    <div
      className={styles.inspector}
      style={{ ['--stage-color' as string]: stage.color }}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className={styles.inspectorHeader}>
        <span className={styles.nodeIcon}>{nodeIcon(def.icon, 13)}</span>
        <input
          className={styles.inspectorTitleInput}
          value={node.title}
          onChange={(e) => renameNode(node.id, e.target.value)}
        />
        <button
          className={styles.inspectorClose}
          title="Delete node"
          onClick={() => removeNode(node.id)}
        >
          <Trash2 size={14} />
        </button>
        <button className={styles.inspectorClose} title="Close" onClick={() => select(null)}>
          <X size={15} />
        </button>
      </div>

      {/* Tabs: parameters · layers · info/versions */}
      <div className={styles.insTabs}>
        <button className={`${styles.deckTab} ${tab === 'params' ? styles.deckTabActive : ''}`} onClick={() => setTab('params')}>
          <SlidersHorizontal size={11} /> Params
        </button>
        <button className={`${styles.deckTab} ${tab === 'retouch' ? styles.deckTabActive : ''}`} onClick={() => setTab('retouch')}>
          <Wand2 size={11} /> Retouch
        </button>
        <button className={`${styles.deckTab} ${tab === 'layers' ? styles.deckTabActive : ''}`} onClick={() => setTab('layers')}>
          <LayersIcon size={11} /> Layers{variant?.layers?.length ? ` (${variant.layers.length})` : ''}
        </button>
        <button className={`${styles.deckTab} ${tab === 'info' ? styles.deckTabActive : ''}`} onClick={() => setTab('info')}>
          <Info size={11} /> Info
        </button>
        {variant?.image && (
          <button className={styles.layerIconBtn} title="Open full layer editor" onClick={() => openEditor(node.id)}>
            <Maximize2 size={12} />
          </button>
        )}
      </div>

      {tab === 'retouch' && (
        <div className={styles.inspectorBody}>
          {variant?.image && (
            <div className={styles.insPreview} onClick={() => openEditor(node.id)} title="Open full layer editor">
              <img src={variant.image} alt={variant.label} />
            </div>
          )}
          <RetouchPanel node={node} apiKey={apiKey} />
        </div>
      )}

      {tab === 'layers' && (
        <div className={styles.inspectorBody}>
          {variant ? (
            <>
              {variant.image && (
                <div className={styles.insPreview} onClick={() => openEditor(node.id)} title="Open full layer editor">
                  <img src={variant.image} alt={variant.label} />
                </div>
              )}
              <LayersPanelBody
                node={node}
                variant={variant}
                selectedLayerId={selectedLayerId}
                onSelectLayer={setSelectedLayerId}
              />
            </>
          ) : (
            <div className={styles.layerEmptyHint}>Generate or import first — layers attach to a result.</div>
          )}
        </div>
      )}

      {tab === 'info' && (
        <div className={styles.inspectorBody}>
          {variant ? (
            <>
              <VariantInfoBody node={node} variant={variant} />
              <div className={styles.section}>
                <div className={styles.sectionTitle}><GitCommitVertical size={10} /> Versions ({node.variants.length})</div>
                {node.variants.map((v) => (
                  <button
                    key={v.id}
                    className={`${styles.versionRow} ${v.id === variant.id ? styles.versionRowActive : ''}`}
                    onClick={() => selectVariant(node.id, v.id)}
                  >
                    <b>v{v.version ?? 1}</b>
                    <span>{v.label}</span>
                    <small>{new Date(v.createdAt).toLocaleTimeString()}</small>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className={styles.layerEmptyHint}>No versions yet — run Generate.</div>
          )}
        </div>
      )}

      {tab === 'params' && (
      <div className={styles.inspectorBody}>
        <div className={styles.nodeSubtitle} style={{ whiteSpace: 'normal' }}>
          {stage.title} · {def.subtitle}
          {def.execution.startsWith('banana') ? ' · powered by your Google banana2 key' : ''}
        </div>

        {/* Prompt templates — reusable recipes for consistent results */}
        <div className={styles.templateBar}>
          {nodeTemplates.length > 0 && (
            <select
              className={styles.selectInput}
              defaultValue=""
              onChange={(e) => { if (e.target.value) applyTemplate(node.id, e.target.value); e.target.value = ''; }}
              title="Apply a saved parameter template"
            >
              <option value="" disabled>Apply template…</option>
              {nodeTemplates.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </select>
          )}
          <input
            className={styles.input}
            placeholder="Save params as template…"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && templateName.trim()) {
                saveTemplate(node.id, templateName);
                setTemplateName('');
              }
            }}
          />
          <button
            className={styles.layerAddBtn}
            disabled={!templateName.trim()}
            onClick={() => { saveTemplate(node.id, templateName); setTemplateName(''); }}
            title="Save the current parameters as a reusable template for this node type"
          >
            Save
          </button>
        </div>

        {sections.map((section, idx) => {
          const open = openSections[section.title] ?? idx === 0;
          return (
          <div key={section.title} className={styles.section}>
            <button
              className={styles.sectionToggle}
              onClick={() => setOpenSections((s) => ({ ...s, [section.title]: !open }))}
              aria-expanded={open}
            >
              <ChevronRight size={11} style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s' }} />
              <span className={styles.sectionTitle} style={{ marginBottom: 0 }}>{section.title}</span>
              <small className={styles.sectionCount}>{section.params.length}</small>
            </button>
            {open && section.params.map((param) => (
              <div key={param.id} className={styles.field}>
                {param.widget === 'toggle' ? (
                  <div className={styles.toggleRow}>
                    <label className={styles.fieldLabel} style={{ marginBottom: 0 }}>{param.label}</label>
                    <FieldWidget
                      param={param}
                      value={node.params[param.id]}
                      onChange={(v) => setParam(node.id, param.id, v)}
                    />
                  </div>
                ) : (
                  <>
                    <label className={styles.fieldLabel}>{param.label}</label>
                    <FieldWidget
                      param={param}
                      value={node.params[param.id]}
                      onChange={(v) => setParam(node.id, param.id, v)}
                      onImportFile={handleImportFile}
                    />
                  </>
                )}
                {param.help && <div className={styles.fieldHelp}>{param.help}</div>}
              </div>
            ))}
          </div>
          );
        })}
      </div>
      )}

      <button
        className={`${styles.tbtn} ${styles.runBtn} ${styles.inspectorRun}`}
        disabled={isRunning}
        onClick={() => void runNode(node.id, apiKey)}
      >
        {isRunning ? <Loader2 size={14} className={styles.spin} /> : <Play size={14} />}
        {def.execution.startsWith('banana')
          ? (node.variants.length > 0 ? 'Regenerate (stacks a new alternative)' : 'Generate')
          : 'Apply'}
      </button>
    </div>
  );
};
