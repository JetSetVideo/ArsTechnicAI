// ─────────────────────────────────────────────────────────────────────────────
// Retouch operations — one-click AI edits applied to a node's active picture.
// Each op builds a precise banana2 image-edit instruction from small forms.
// Client-safe.
// ─────────────────────────────────────────────────────────────────────────────

import type { ParamOption } from '@/types/pipeline';
import {
  CAMERA_SHOTS, CAMERA_ANGLES, LIGHTING, TIME_OF_DAY, WEATHER, ART_STYLES, MOODS,
} from '@/lib/pipeline/catalog';

export interface RetouchField {
  id: string;
  label: string;
  widget: 'text' | 'textarea' | 'select' | 'slider';
  options?: ParamOption[];
  placeholder?: string;
  default?: string | number;
  min?: number;
  max?: number;
  step?: number;
}

export interface RetouchOp {
  id: string;
  label: string;
  icon: string;              // key into the workshop icon map
  hint: string;
  fields: RetouchField[];
  /** Builds the edit instruction; {fieldId} placeholders are substituted. */
  template: string;
}

const PRESERVE = 'Keep everything else identical: composition, identity, framing and style.';

export const RETOUCH_OPS: RetouchOp[] = [
  {
    id: 'cleanup', label: 'Retouch', icon: 'wand', hint: 'Fix flaws, remove artifacts',
    fields: [
      { id: 'what', label: 'What to fix', widget: 'textarea', placeholder: 'blurry hand, banding in the sky, stray hair…' },
      { id: 'strength', label: 'Strength', widget: 'slider', default: 0.6, min: 0.2, max: 1, step: 0.1 },
    ],
    template: 'Retouch this image: fix {what}. Subtle, professional cleanup at {strength} strength. ' + PRESERVE,
  },
  {
    id: 'character', label: 'Character', icon: 'user', hint: 'Swap or restyle a character',
    fields: [
      { id: 'who', label: 'Which character', widget: 'text', placeholder: 'the woman in the red coat' },
      { id: 'change', label: 'Change to', widget: 'textarea', placeholder: 'an older sailor with a grey beard and oilskin jacket…' },
      { id: 'keepPose', label: 'Keep pose', widget: 'select', default: 'yes', options: [{ value: 'yes', label: 'Keep exact pose' }, { value: 'no', label: 'Pose may adapt' }] },
    ],
    template: 'Replace {who} with {change}. Keep pose: {keepPose}. Match the scene lighting and perspective. ' + PRESERVE,
  },
  {
    id: 'time', label: 'Time of day', icon: 'clock', hint: 'Dawn, dusk, night…',
    fields: [{ id: 'time', label: 'New time', widget: 'select', options: TIME_OF_DAY, default: 'golden-hour' }],
    template: 'Change the time of day to {time}: adjust sky, shadows, color temperature and practical lights accordingly. ' + PRESERVE,
  },
  {
    id: 'lighting', label: 'Lighting', icon: 'sun', hint: 'Relight the scene',
    fields: [
      { id: 'setup', label: 'Lighting setup', widget: 'select', options: LIGHTING, default: 'rembrandt' },
      { id: 'notes', label: 'Notes', widget: 'text', placeholder: 'key from left, warm rim…' },
    ],
    template: 'Relight the scene with {setup} lighting. {notes}. Physically plausible shadows and speculars. ' + PRESERVE,
  },
  {
    id: 'color', label: 'Color', icon: 'droplet', hint: 'Adapt the color story',
    fields: [
      { id: 'direction', label: 'Color direction', widget: 'textarea', placeholder: 'teal shadows, amber highlights, muted mids — like a cold coastal morning' },
      { id: 'mood', label: 'Mood', widget: 'select', options: MOODS, default: 'melancholic' },
    ],
    template: 'Adapt the color grading: {direction}. Overall {mood} mood. Do not change any content, only color. ' + PRESERVE,
  },
  {
    id: 'camera', label: 'Camera', icon: 'camera', hint: 'Re-render from another angle',
    fields: [
      { id: 'shot', label: 'Shot size', widget: 'select', options: CAMERA_SHOTS, default: 'close-up' },
      { id: 'angle', label: 'Angle', widget: 'select', options: CAMERA_ANGLES, default: 'low' },
    ],
    template: 'Re-render this exact scene as a {shot} from a {angle} angle. Same subjects, same moment, same lighting and style — only the camera moves.',
  },
  {
    id: 'add', label: 'Add object', icon: 'plus-circle', hint: 'Insert an element',
    fields: [
      { id: 'what', label: 'What to add', widget: 'textarea', placeholder: 'a brass telescope on the table' },
      { id: 'where', label: 'Where', widget: 'text', placeholder: 'lower-left foreground' },
    ],
    template: 'Add {what} at {where}. Integrate it with correct perspective, scale, lighting and shadows. ' + PRESERVE,
  },
  {
    id: 'remove', label: 'Remove', icon: 'eraser', hint: 'Erase an element',
    fields: [{ id: 'what', label: 'What to remove', widget: 'textarea', placeholder: 'the power lines in the sky' }],
    template: 'Remove {what} completely and reconstruct the background seamlessly. ' + PRESERVE,
  },
  {
    id: 'weather', label: 'Weather', icon: 'cloud', hint: 'Rain, fog, snow…',
    fields: [{ id: 'weather', label: 'New weather', widget: 'select', options: WEATHER, default: 'fog' }],
    template: 'Change the weather to {weather}: atmosphere, precipitation, wetness and light diffusion must all follow. ' + PRESERVE,
  },
  {
    id: 'style', label: 'Style', icon: 'brush', hint: 'Restyle the whole frame',
    fields: [
      { id: 'style', label: 'Target style', widget: 'select', options: ART_STYLES, default: 'watercolor' },
      { id: 'strength', label: 'Strength', widget: 'slider', default: 0.8, min: 0.2, max: 1, step: 0.1 },
    ],
    template: 'Restyle this image as {style} at {strength} intensity while preserving composition, subjects and values.',
  },
  {
    id: 'background', label: 'Background', icon: 'mountain', hint: 'Swap the backdrop',
    fields: [{ id: 'bg', label: 'New background', widget: 'textarea', placeholder: 'a stormy harbor at blue hour' }],
    template: 'Replace the background with {bg}. Keep all foreground subjects perfectly intact with clean edges and matched lighting.',
  },
  {
    id: 'expression', label: 'Expression', icon: 'smile', hint: 'Change face / pose',
    fields: [
      { id: 'who', label: 'Subject', widget: 'text', placeholder: 'the main character', default: 'the main character' },
      { id: 'to', label: 'New expression / pose', widget: 'textarea', placeholder: 'a weary half-smile, eyes toward the horizon' },
    ],
    template: 'Change the expression/pose of {who} to: {to}. Keep identity, wardrobe and lighting identical. ' + PRESERVE,
  },
  {
    id: 'focus', label: 'Focus', icon: 'focus', hint: 'Rack focus / depth of field',
    fields: [
      { id: 'subject', label: 'Focus on', widget: 'text', placeholder: 'her eyes, the key on the table…' },
      { id: 'dof', label: 'Depth of field', widget: 'select', default: 'shallow',
        options: [
          { value: 'razor-thin', label: 'Razor thin (macro)' },
          { value: 'shallow', label: 'Shallow (portrait bokeh)' },
          { value: 'medium', label: 'Medium' },
          { value: 'deep', label: 'Deep focus (everything sharp)' },
        ] },
      { id: 'bokeh', label: 'Bokeh style', widget: 'select', default: 'creamy',
        options: [
          { value: 'creamy', label: 'Creamy smooth' },
          { value: 'swirly', label: 'Swirly vintage' },
          { value: 'anamorphic', label: 'Anamorphic oval' },
          { value: 'busy', label: 'Busy / nervous' },
        ] },
    ],
    template: 'Change the focus: make {subject} tack sharp with {dof} depth of field and {bokeh} bokeh falloff. Physically plausible lens blur. ' + PRESERVE,
  },
  {
    id: 'detail', label: 'Enhance', icon: 'sparkle', hint: 'More detail & sharpness',
    fields: [{ id: 'strength', label: 'Boost', widget: 'slider', default: 0.5, min: 0.1, max: 1, step: 0.1 }],
    template: 'Enhance fine detail, texture and micro-contrast at {strength} strength. No content or composition changes.',
  },
];

export function buildRetouchInstruction(op: RetouchOp, values: Record<string, string | number>): string {
  let out = op.template;
  for (const f of op.fields) {
    const v = values[f.id] ?? f.default ?? '';
    out = out.split(`{${f.id}}`).join(String(v));
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}
