import React, { useState } from 'react';
import {
  Wand2, User, Clock, Sun, Droplet, Camera, PlusCircle, Eraser, Cloud,
  Brush, Mountain, Smile, Sparkles, Play, Loader2, ChevronLeft, Focus,
} from 'lucide-react';
import type { PipelineNode } from '@/types/pipeline';
import { RETOUCH_OPS, buildRetouchInstruction, type RetouchOp } from '@/lib/pipeline/retouch';
import { usePipelineStore } from '@/stores/pipelineStore';
import { activeVariantOf } from './LayerSystem';
import styles from './WorkshopFlow.module.css';

const OP_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  wand: Wand2, user: User, clock: Clock, sun: Sun, droplet: Droplet,
  camera: Camera, 'plus-circle': PlusCircle, eraser: Eraser, cloud: Cloud,
  brush: Brush, mountain: Mountain, smile: Smile, sparkle: Sparkles, focus: Focus,
};

/**
 * One-click AI retouch: pick an operation (character, time, lighting, camera,
 * color, add/remove object…), fill its short form, apply — the edited picture
 * stacks as a new version on the node.
 */
export const RetouchPanel: React.FC<{ node: PipelineNode; apiKey: string }> = ({ node, apiKey }) => {
  const { retouchVariant } = usePipelineStore();
  const [op, setOp] = useState<RetouchOp | null>(null);
  const [values, setValues] = useState<Record<string, string | number>>({});
  const variant = activeVariantOf(node);
  const isRunning = node.status === 'running';

  if (!variant?.image) {
    return (
      <div className={styles.layerEmptyHint}>
        Retouch works on a generated or imported picture. Run Generate (or import) first,
        then swap characters, relight, change time of day, move the camera, add or remove
        objects — each edit stacks as a new version.
      </div>
    );
  }

  if (!op) {
    return (
      <div className={styles.retouchGrid}>
        {RETOUCH_OPS.map((o) => {
          const Icon = OP_ICONS[o.icon] ?? Wand2;
          return (
            <button
              key={o.id}
              className={styles.retouchChip}
              title={o.hint}
              onClick={() => { setOp(o); setValues({}); }}
            >
              <Icon size={15} />
              <span>{o.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const Icon = OP_ICONS[op.icon] ?? Wand2;
  const instruction = buildRetouchInstruction(op, values);

  return (
    <div className={styles.retouchForm}>
      <button className={styles.retouchBack} onClick={() => setOp(null)}>
        <ChevronLeft size={12} /> All operations
      </button>
      <div className={styles.retouchHeader}>
        <Icon size={14} />
        <b>{op.label}</b>
        <small>{op.hint}</small>
      </div>

      {op.fields.map((f) => (
        <div key={f.id} className={styles.field}>
          <label className={styles.fieldLabel}>{f.label}</label>
          {f.widget === 'textarea' && (
            <textarea
              className={styles.textarea}
              placeholder={f.placeholder}
              value={(values[f.id] as string) ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
            />
          )}
          {f.widget === 'text' && (
            <input
              className={styles.input}
              placeholder={f.placeholder}
              value={(values[f.id] as string) ?? (f.default as string) ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
            />
          )}
          {f.widget === 'select' && (
            <select
              className={styles.selectInput}
              value={(values[f.id] as string) ?? (f.default as string) ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
            >
              {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {f.widget === 'slider' && (
            <div className={styles.sliderRow}>
              <input
                type="range"
                className={styles.slider}
                min={f.min ?? 0} max={f.max ?? 1} step={f.step ?? 0.1}
                value={(values[f.id] as number) ?? (f.default as number) ?? 0.5}
                onChange={(e) => setValues((v) => ({ ...v, [f.id]: Number(e.target.value) }))}
              />
              <span className={styles.sliderValue}>{String(values[f.id] ?? f.default ?? 0.5)}</span>
            </div>
          )}
        </div>
      ))}

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Instruction sent to banana2</label>
        <div className={styles.promptBox}>{instruction}</div>
      </div>

      <button
        className={styles.flattenBtn}
        disabled={isRunning || !apiKey}
        title={apiKey ? 'Apply this edit — result stacks as a new version' : 'Add your Google API key in Settings first'}
        onClick={() => void retouchVariant(node.id, variant.id, op.label, instruction, apiKey)}
      >
        {isRunning ? <Loader2 size={12} className={styles.spin} /> : <Play size={12} />}
        Apply → new version{apiKey ? '' : ' (needs API key)'}
      </button>
      {node.status === 'error' && <div className={styles.errorText}>{node.error}</div>}
    </div>
  );
};
