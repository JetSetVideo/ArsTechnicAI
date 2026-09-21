// ─────────────────────────────────────────────────────────────────────────────
// Workshop Pipeline — complete stage & node catalog
//
// Client-safe (no Node APIs). Every node lists its full parameter set so the
// inspector, prompt builder, and execution engine are all driven from here.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  PipelineStageDef,
  PipelineNodeDef,
  PipelineStageId,
  ParamDef,
  ParamOption,
} from '@/types/pipeline';

const opts = (...values: [string, string][]): ParamOption[] =>
  values.map(([value, label]) => ({ value, label }));

// ── Shared option sets ───────────────────────────────────────────────────────

export const ASPECT_RATIOS = opts(
  ['16:9', '16:9 — YouTube / Cinema TV'],
  ['9:16', '9:16 — TikTok / Reels / Shorts'],
  ['1:1', '1:1 — Instagram square'],
  ['4:5', '4:5 — Instagram portrait'],
  ['4:3', '4:3 — Classic TV'],
  ['3:2', '3:2 — Photo'],
  ['21:9', '21:9 — Ultrawide'],
  ['2.39:1', '2.39:1 — Anamorphic cinema'],
);

export const ART_STYLES = opts(
  ['photorealistic', 'Photorealistic'],
  ['cinematic', 'Cinematic film still'],
  ['anime', 'Anime'],
  ['manga', 'Manga (B&W)'],
  ['3d-render', '3D render / CGI'],
  ['pixar', 'Stylized 3D (Pixar-like)'],
  ['watercolor', 'Watercolor'],
  ['oil-painting', 'Oil painting'],
  ['pencil-sketch', 'Pencil sketch'],
  ['ink', 'Ink illustration'],
  ['comic', 'Comic book'],
  ['pixel-art', 'Pixel art'],
  ['low-poly', 'Low poly'],
  ['claymation', 'Claymation'],
  ['noir', 'Film noir'],
  ['cyberpunk', 'Cyberpunk'],
  ['vaporwave', 'Vaporwave'],
  ['documentary', 'Documentary realism'],
);

export const CAMERA_SHOTS = opts(
  ['extreme-wide', 'Extreme wide (EWS)'],
  ['wide', 'Wide (WS)'],
  ['full', 'Full shot (FS)'],
  ['medium-wide', 'Medium wide (MWS)'],
  ['medium', 'Medium (MS)'],
  ['medium-close', 'Medium close-up (MCU)'],
  ['close-up', 'Close-up (CU)'],
  ['extreme-close', 'Extreme close-up (ECU)'],
  ['over-shoulder', 'Over-the-shoulder (OTS)'],
  ['two-shot', 'Two shot'],
  ['insert', 'Insert / detail'],
  ['pov', 'POV'],
  ['aerial', 'Aerial / drone'],
);

export const CAMERA_ANGLES = opts(
  ['eye-level', 'Eye level'],
  ['low', 'Low angle'],
  ['high', 'High angle'],
  ['dutch', 'Dutch tilt'],
  ['birds-eye', "Bird's-eye"],
  ['worms-eye', "Worm's-eye"],
  ['top-down', 'Top-down'],
);

export const CAMERA_MOVES = opts(
  ['static', 'Static / locked-off'],
  ['pan-left', 'Pan left'],
  ['pan-right', 'Pan right'],
  ['tilt-up', 'Tilt up'],
  ['tilt-down', 'Tilt down'],
  ['dolly-in', 'Dolly in'],
  ['dolly-out', 'Dolly out'],
  ['truck-left', 'Truck left'],
  ['truck-right', 'Truck right'],
  ['crane-up', 'Crane up'],
  ['crane-down', 'Crane down'],
  ['zoom-in', 'Zoom in'],
  ['zoom-out', 'Zoom out'],
  ['handheld', 'Handheld'],
  ['steadicam', 'Steadicam follow'],
  ['orbit', 'Orbit / arc'],
  ['whip-pan', 'Whip pan'],
  ['vertigo', 'Dolly zoom (vertigo)'],
);

export const LENSES = opts(
  ['14mm', '14mm ultra-wide'],
  ['24mm', '24mm wide'],
  ['35mm', '35mm street'],
  ['50mm', '50mm standard'],
  ['85mm', '85mm portrait'],
  ['135mm', '135mm tele'],
  ['200mm', '200mm long tele'],
  ['macro', 'Macro'],
  ['fisheye', 'Fisheye'],
  ['anamorphic', 'Anamorphic'],
  ['tilt-shift', 'Tilt-shift'],
);

export const LIGHTING = opts(
  ['natural', 'Natural light'],
  ['golden-hour', 'Golden hour'],
  ['blue-hour', 'Blue hour'],
  ['overcast', 'Overcast soft'],
  ['midday', 'Hard midday sun'],
  ['night', 'Night exterior'],
  ['moonlight', 'Moonlight'],
  ['neon', 'Neon / practical signs'],
  ['candlelight', 'Candlelight'],
  ['firelight', 'Firelight'],
  ['three-point', 'Studio three-point'],
  ['rembrandt', 'Rembrandt'],
  ['rim', 'Rim / back light'],
  ['silhouette', 'Silhouette'],
  ['low-key', 'Low-key dramatic'],
  ['high-key', 'High-key bright'],
  ['volumetric', 'Volumetric god rays'],
  ['underwater', 'Underwater caustics'],
);

export const MOODS = opts(
  ['serene', 'Serene'], ['joyful', 'Joyful'], ['melancholic', 'Melancholic'],
  ['tense', 'Tense'], ['ominous', 'Ominous'], ['mysterious', 'Mysterious'],
  ['romantic', 'Romantic'], ['epic', 'Epic'], ['nostalgic', 'Nostalgic'],
  ['whimsical', 'Whimsical'], ['gritty', 'Gritty'], ['dreamlike', 'Dreamlike'],
  ['claustrophobic', 'Claustrophobic'], ['triumphant', 'Triumphant'],
  ['bittersweet', 'Bittersweet'], ['unsettling', 'Unsettling'],
);

export const GENRES = opts(
  ['drama', 'Drama'], ['comedy', 'Comedy'], ['thriller', 'Thriller'],
  ['horror', 'Horror'], ['scifi', 'Science fiction'], ['fantasy', 'Fantasy'],
  ['romance', 'Romance'], ['action', 'Action'], ['adventure', 'Adventure'],
  ['mystery', 'Mystery'], ['western', 'Western'], ['noir', 'Noir'],
  ['documentary', 'Documentary'], ['musical', 'Musical'],
  ['slice-of-life', 'Slice of life'], ['ad', 'Commercial / Ad'],
  ['music-video', 'Music video'], ['explainer', 'Explainer'],
);

export const TIME_OF_DAY = opts(
  ['dawn', 'Dawn'], ['morning', 'Morning'], ['midday', 'Midday'],
  ['afternoon', 'Afternoon'], ['golden-hour', 'Golden hour'],
  ['dusk', 'Dusk'], ['night', 'Night'], ['midnight', 'Midnight'],
);

export const WEATHER = opts(
  ['clear', 'Clear'], ['cloudy', 'Cloudy'], ['overcast', 'Overcast'],
  ['rain', 'Rain'], ['storm', 'Thunderstorm'], ['snow', 'Snow'],
  ['fog', 'Fog'], ['mist', 'Mist'], ['wind', 'Windy'], ['heatwave', 'Heat haze'],
);

export const TRANSITIONS = opts(
  ['cut', 'Hard cut'], ['dissolve', 'Cross dissolve'], ['fade-black', 'Fade to black'],
  ['fade-white', 'Fade to white'], ['wipe', 'Wipe'], ['iris', 'Iris'],
  ['whip', 'Whip pan'], ['match-cut', 'Match cut'], ['j-cut', 'J-cut (audio leads)'],
  ['l-cut', 'L-cut (audio trails)'], ['smash', 'Smash cut'], ['zoom', 'Zoom transition'],
  ['glitch', 'Glitch'], ['morph', 'AI morph'],
);

export const VOICE_STYLES = opts(
  ['natural', 'Natural conversational'], ['warm', 'Warm narrator'],
  ['deep', 'Deep gravitas'], ['bright', 'Bright energetic'],
  ['soft', 'Soft intimate'], ['authoritative', 'Authoritative'],
  ['playful', 'Playful'], ['elderly', 'Elderly'], ['child', 'Child'],
  ['robotic', 'Robotic / synthetic'], ['whisper', 'Whisper'],
  ['announcer', 'Movie-trailer announcer'],
);

export const MUSIC_GENRES = opts(
  ['orchestral', 'Orchestral score'], ['piano', 'Solo piano'],
  ['ambient', 'Ambient'], ['electronic', 'Electronic'], ['synthwave', 'Synthwave'],
  ['lofi', 'Lo-fi'], ['rock', 'Rock'], ['jazz', 'Jazz'], ['hip-hop', 'Hip-hop'],
  ['folk', 'Folk / acoustic'], ['epic-trailer', 'Epic trailer'],
  ['horror-drone', 'Horror drones'], ['world', 'World / ethnic'],
  ['chiptune', 'Chiptune'], ['none', 'No music'],
);

const LANGUAGES = opts(
  ['en', 'English'], ['fr', 'Français'], ['es', 'Español'], ['de', 'Deutsch'],
  ['it', 'Italiano'], ['pt', 'Português'], ['ja', '日本語'], ['ko', '한국어'],
  ['zh', '中文'], ['ar', 'العربية'], ['hi', 'हिन्दी'], ['ru', 'Русский'],
);

// ── Shared param fragments ───────────────────────────────────────────────────

const seedParam: ParamDef = {
  id: 'seed', label: 'Seed', widget: 'seed', section: 'Generation',
  default: -1, help: '-1 = random each run; fix it to reproduce a result',
};

const variantCountParam: ParamDef = {
  id: 'variantCount', label: 'Alternatives per run', widget: 'slider',
  section: 'Generation', default: 1, min: 1, max: 6, step: 1,
  help: 'Each run stacks this many alternatives on the node',
};

const styleParams: ParamDef[] = [
  { id: 'artStyle', label: 'Art style', widget: 'select', section: 'Style', options: ART_STYLES, default: 'cinematic', promptable: true },
  { id: 'styleStrength', label: 'Style strength', widget: 'slider', section: 'Style', default: 0.8, min: 0, max: 1, step: 0.05 },
  { id: 'mood', label: 'Mood', widget: 'select', section: 'Style', options: MOODS, default: 'serene', promptable: true },
  { id: 'colorNotes', label: 'Color notes', widget: 'text', section: 'Style', placeholder: 'teal & orange, desaturated shadows…', promptable: true },
];

const cameraParams: ParamDef[] = [
  { id: 'shotSize', label: 'Shot size', widget: 'select', section: 'Camera', options: CAMERA_SHOTS, default: 'medium', promptable: true },
  { id: 'angle', label: 'Angle', widget: 'select', section: 'Camera', options: CAMERA_ANGLES, default: 'eye-level', promptable: true },
  { id: 'lens', label: 'Lens', widget: 'select', section: 'Camera', options: LENSES, default: '35mm', promptable: true },
  { id: 'depthOfField', label: 'Depth of field', widget: 'select', section: 'Camera', promptable: true, default: 'shallow',
    options: opts(['shallow', 'Shallow (bokeh)'], ['medium', 'Medium'], ['deep', 'Deep focus']) },
  { id: 'lighting', label: 'Lighting', widget: 'select', section: 'Lighting', options: LIGHTING, default: 'natural', promptable: true },
];

// ── Stage definitions ────────────────────────────────────────────────────────

export const STAGES: Record<PipelineStageId, PipelineStageDef> = {
  concept: { id: 'concept', order: 0, title: 'Moodboard', tagline: 'References, palettes & style DNA', color: '#f59e0b', icon: 'palette' },
  script: { id: 'script', order: 1, title: 'Script', tagline: 'Logline, screenplay & dialogue', color: '#6366f1', icon: 'scroll' },
  world: { id: 'world', order: 2, title: 'World', tagline: 'Characters, locations & props', color: '#22c55e', icon: 'users' },
  storyboard: { id: 'storyboard', order: 3, title: 'Storyboard', tagline: 'Shot list, frames & animatic', color: '#0ea5e9', icon: 'layout-grid' },
  visual: { id: 'visual', order: 4, title: 'Visuals', tagline: 'Key images, edits & grading', color: '#a855f7', icon: 'image' },
  motion: { id: 'motion', order: 5, title: 'Motion', tagline: 'Animation, camera moves & video', color: '#ec4899', icon: 'clapperboard' },
  audio: { id: 'audio', order: 6, title: 'Audio', tagline: 'Dialogue, music, SFX & mix', color: '#14b8a6', icon: 'music', },
  assembly: { id: 'assembly', order: 7, title: 'Montage', tagline: 'Cuts, transitions, subtitles & overlays', color: '#f97316', icon: 'film' },
  delivery: { id: 'delivery', order: 8, title: 'Delivery', tagline: 'Formats, transcode & publish', color: '#84cc16', icon: 'send' },
};

export const STAGE_ORDER: PipelineStageId[] = (Object.values(STAGES) as PipelineStageDef[])
  .sort((a, b) => a.order - b.order)
  .map((s) => s.id);

// ── Node catalog ─────────────────────────────────────────────────────────────

export const PIPELINE_NODE_DEFS: Record<string, PipelineNodeDef> = {

  // ═══ STAGE 1 — CONCEPT / MOODBOARD ════════════════════════════════════════

  'moodboard-import': {
    type: 'moodboard-import', stage: 'concept',
    title: 'Import References', subtitle: 'Drop inspiration images', icon: 'upload',
    execution: 'import',
    inputs: [],
    outputs: [{ id: 'images', label: 'References', type: 'image-set' }],
    params: [
      { id: 'files', label: 'Images', widget: 'file', section: 'Source' },
      { id: 'note', label: 'Why these?', widget: 'textarea', section: 'Source', placeholder: 'What to borrow: light, texture, framing…', promptable: true },
      { id: 'tags', label: 'Tags', widget: 'tags', section: 'Source' },
    ],
  },

  'moodboard-gen': {
    type: 'moodboard-gen', stage: 'concept',
    title: 'Generate Moodboard', subtitle: 'banana2 concept frames', icon: 'sparkles',
    execution: 'banana-image',
    inputs: [{ id: 'refs', label: 'References', type: 'image-set', optional: true, multi: true }],
    outputs: [{ id: 'images', label: 'Moodboard', type: 'image-set' }],
    promptTemplate: 'Moodboard concept frame for a {genre} project. Theme: {theme}. {mood} mood, {artStyle} style. Color world: {colorNotes}. Textures: {textures}. Era: {era}. {extra}',
    params: [
      { id: 'theme', label: 'Theme / subject', widget: 'textarea', section: 'Concept', placeholder: 'A lighthouse keeper who collects storms…', promptable: true },
      { id: 'genre', label: 'Genre', widget: 'select', section: 'Concept', options: GENRES, default: 'drama', promptable: true },
      { id: 'era', label: 'Era / period', widget: 'text', section: 'Concept', placeholder: '1970s, medieval, far future…', promptable: true },
      { id: 'textures', label: 'Textures & materials', widget: 'text', section: 'Concept', placeholder: 'rust, wet asphalt, brushed brass…', promptable: true },
      { id: 'extra', label: 'Extra direction', widget: 'textarea', section: 'Concept', promptable: true },
      ...styleParams,
      { id: 'aspectRatio', label: 'Aspect ratio', widget: 'aspect', section: 'Generation', options: ASPECT_RATIOS, default: '16:9' },
      seedParam, variantCountParam,
    ],
  },

  'palette-extract': {
    type: 'palette-extract', stage: 'concept',
    title: 'Palette', subtitle: 'Extract or author colors', icon: 'droplet',
    execution: 'local',
    inputs: [{ id: 'image', label: 'Image', type: 'image', optional: true }],
    outputs: [{ id: 'palette', label: 'Palette', type: 'palette' }],
    params: [
      { id: 'count', label: 'Swatch count', widget: 'slider', section: 'Palette', default: 6, min: 3, max: 12, step: 1 },
      { id: 'mode', label: 'Mode', widget: 'select', section: 'Palette', default: 'vibrant',
        options: opts(['vibrant', 'Vibrant'], ['muted', 'Muted'], ['dominant', 'Dominant'], ['manual', 'Manual']) },
      { id: 'c1', label: 'Swatch 1', widget: 'color', section: 'Manual swatches', default: '#1a1a2e' },
      { id: 'c2', label: 'Swatch 2', widget: 'color', section: 'Manual swatches', default: '#16213e' },
      { id: 'c3', label: 'Swatch 3', widget: 'color', section: 'Manual swatches', default: '#0f3460' },
      { id: 'c4', label: 'Swatch 4', widget: 'color', section: 'Manual swatches', default: '#e94560' },
      { id: 'c5', label: 'Swatch 5', widget: 'color', section: 'Manual swatches', default: '#f5f5f5' },
      { id: 'c6', label: 'Swatch 6', widget: 'color', section: 'Manual swatches', default: '#ffd460' },
    ],
  },

  'style-dna': {
    type: 'style-dna', stage: 'concept',
    title: 'Style DNA', subtitle: 'Lock the visual identity', icon: 'fingerprint',
    execution: 'manual',
    inputs: [
      { id: 'refs', label: 'References', type: 'image-set', optional: true },
      { id: 'palette', label: 'Palette', type: 'palette', optional: true },
    ],
    outputs: [{ id: 'style', label: 'Style', type: 'style' }],
    params: [
      { id: 'artStyle', label: 'Art style', widget: 'select', section: 'Identity', options: ART_STYLES, default: 'cinematic', promptable: true },
      { id: 'filmStock', label: 'Film stock / look', widget: 'select', section: 'Identity', promptable: true, default: 'none',
        options: opts(['none', 'None'], ['kodak-portra', 'Kodak Portra 400'], ['fuji-velvia', 'Fuji Velvia 50'], ['kodak-2383', 'Kodak 2383 print'], ['ilford-hp5', 'Ilford HP5 B&W'], ['polaroid', 'Polaroid'], ['vhs', 'VHS'], ['16mm', '16mm grain'], ['imax', 'IMAX 70mm']) },
      { id: 'grain', label: 'Grain amount', widget: 'slider', section: 'Identity', default: 0.2, min: 0, max: 1, step: 0.05 },
      { id: 'contrast', label: 'Contrast', widget: 'slider', section: 'Identity', default: 0.5, min: 0, max: 1, step: 0.05 },
      { id: 'saturation', label: 'Saturation', widget: 'slider', section: 'Identity', default: 0.5, min: 0, max: 1, step: 0.05 },
      { id: 'keywords', label: 'Signature keywords', widget: 'tags', section: 'Identity', help: 'Injected into every downstream generation', promptable: true },
      { id: 'avoid', label: 'Always avoid', widget: 'tags', section: 'Identity', help: 'Negative direction for all stages', promptable: true },
    ],
  },

  // ═══ STAGE 2 — SCRIPT ════════════════════════════════════════════════════

  'script-import': {
    type: 'script-import', stage: 'script',
    title: 'Import Script', subtitle: 'Paste or upload screenplay', icon: 'file-text',
    execution: 'import',
    inputs: [],
    outputs: [{ id: 'script', label: 'Script', type: 'script' }],
    params: [
      { id: 'text', label: 'Script text', widget: 'textarea', section: 'Source', placeholder: 'Paste screenplay, treatment or beats…' },
      { id: 'format', label: 'Format', widget: 'select', section: 'Source', default: 'fountain',
        options: opts(['fountain', 'Fountain / screenplay'], ['markdown', 'Markdown treatment'], ['beats', 'Beat list'], ['prose', 'Prose']) },
    ],
  },

  'logline-gen': {
    type: 'logline-gen', stage: 'script',
    title: 'Logline & Premise', subtitle: 'One-sentence core', icon: 'quote',
    execution: 'banana-text',
    inputs: [{ id: 'concept', label: 'Concept', type: 'text', optional: true }],
    outputs: [{ id: 'logline', label: 'Logline', type: 'text' }],
    promptTemplate: 'Write {variantCount} distinct loglines for a {genre} {format}. Premise: {premise}. Protagonist: {protagonist}. Stakes: {stakes}. Tone: {tone}. Each logline: one sentence, max 40 words.',
    params: [
      { id: 'premise', label: 'Premise', widget: 'textarea', section: 'Story', promptable: true },
      { id: 'protagonist', label: 'Protagonist', widget: 'text', section: 'Story', promptable: true },
      { id: 'stakes', label: 'Stakes', widget: 'text', section: 'Story', promptable: true },
      { id: 'genre', label: 'Genre', widget: 'select', section: 'Story', options: GENRES, default: 'drama', promptable: true },
      { id: 'tone', label: 'Tone', widget: 'select', section: 'Story', options: MOODS, default: 'epic', promptable: true },
      { id: 'format', label: 'Format', widget: 'select', section: 'Story', default: 'short-film', promptable: true,
        options: opts(['short-film', 'Short film'], ['feature', 'Feature'], ['ad', 'Ad spot'], ['music-video', 'Music video'], ['social', 'Social short'], ['series-ep', 'Series episode'], ['trailer', 'Trailer']) },
      variantCountParam,
    ],
  },

  'script-gen': {
    type: 'script-gen', stage: 'script',
    title: 'Write Script', subtitle: 'Full screenplay generation', icon: 'pen-line',
    execution: 'banana-text',
    inputs: [
      { id: 'logline', label: 'Logline', type: 'text', optional: true },
      { id: 'moodboard', label: 'Moodboard', type: 'image-set', optional: true },
    ],
    outputs: [{ id: 'script', label: 'Script', type: 'script' }],
    promptTemplate: 'Write a {length}-minute {genre} screenplay in Fountain format. Logline: {logline}. Acts: {actStructure}. Audience: {audience}. Language: {language}. Dialogue style: {dialogueStyle}. Setting: {setting}. Include scene headings, action lines, and realistic dialogue. {notes}',
    params: [
      { id: 'logline', label: 'Logline (if no input)', widget: 'textarea', section: 'Story', promptable: true },
      { id: 'length', label: 'Target length (min)', widget: 'slider', section: 'Story', default: 2, min: 1, max: 30, step: 1, promptable: true },
      { id: 'genre', label: 'Genre', widget: 'select', section: 'Story', options: GENRES, default: 'drama', promptable: true },
      { id: 'actStructure', label: 'Structure', widget: 'select', section: 'Story', default: 'three-act', promptable: true,
        options: opts(['three-act', 'Three acts'], ['five-act', 'Five acts'], ['heros-journey', "Hero's journey"], ['kishotenketsu', 'Kishōtenketsu'], ['nonlinear', 'Non-linear'], ['vignette', 'Vignette'], ['loop', 'Loop / hook (social)']) },
      { id: 'setting', label: 'Setting', widget: 'text', section: 'Story', promptable: true },
      { id: 'audience', label: 'Audience', widget: 'select', section: 'Story', default: 'general', promptable: true,
        options: opts(['general', 'General'], ['kids', 'Kids'], ['teens', 'Teens'], ['adults', 'Adults'], ['professional', 'Professional / B2B']) },
      { id: 'dialogueStyle', label: 'Dialogue style', widget: 'select', section: 'Dialogue', default: 'naturalistic', promptable: true,
        options: opts(['naturalistic', 'Naturalistic'], ['snappy', 'Snappy / witty'], ['sparse', 'Sparse / minimal'], ['theatrical', 'Theatrical'], ['voiceover', 'Voice-over driven'], ['silent', 'No dialogue']) },
      { id: 'language', label: 'Language', widget: 'select', section: 'Dialogue', options: LANGUAGES, default: 'en', promptable: true },
      { id: 'notes', label: 'Director notes', widget: 'textarea', section: 'Story', promptable: true },
      { id: 'temperature', label: 'Creativity', widget: 'slider', section: 'Generation', default: 0.9, min: 0, max: 2, step: 0.1 },
      variantCountParam,
    ],
  },

  'dialogue-polish': {
    type: 'dialogue-polish', stage: 'script',
    title: 'Polish Dialogue', subtitle: 'Make lines realistic', icon: 'message-circle',
    execution: 'banana-text',
    inputs: [{ id: 'script', label: 'Script', type: 'script' }],
    outputs: [{ id: 'script', label: 'Script', type: 'script' }],
    promptTemplate: 'Rewrite ONLY the dialogue of this screenplay to be more {direction}. Keep structure, scene headings, and action lines untouched. Subtext level: {subtext}. Keep each character voice distinct. {notes}\n\nSCRIPT:\n{__input_script}',
    params: [
      { id: 'direction', label: 'Direction', widget: 'select', section: 'Polish', default: 'realistic', promptable: true,
        options: opts(['realistic', 'Realistic & natural'], ['funnier', 'Funnier'], ['tighter', 'Tighter / shorter'], ['darker', 'Darker'], ['warmer', 'Warmer'], ['period', 'Period-accurate']) },
      { id: 'subtext', label: 'Subtext', widget: 'slider', section: 'Polish', default: 0.6, min: 0, max: 1, step: 0.1, help: '0 = on-the-nose, 1 = everything implied', promptable: true },
      { id: 'notes', label: 'Notes', widget: 'textarea', section: 'Polish', promptable: true },
      variantCountParam,
    ],
  },

  'prompt-craft': {
    type: 'prompt-craft', stage: 'script',
    title: 'Prompt Lab', subtitle: 'Craft image prompts from story', icon: 'flask',
    execution: 'banana-text',
    inputs: [
      { id: 'script', label: 'Script', type: 'script', optional: true },
      { id: 'moodboard', label: 'Moodboard', type: 'image-set', optional: true },
      { id: 'style', label: 'Style', type: 'style', optional: true },
    ],
    outputs: [{ id: 'prompts', label: 'Prompts', type: 'text' }],
    promptTemplate: 'Act as a prompt engineer for an image model. From this story material, craft {count} production-ready image prompts for the {target} moment. Each prompt: subject + action, {detailLevel} detail, camera (shot size, lens, angle), lighting, mood, style keywords, and a negative list. Format each as "PROMPT n:" then the prompt, then "NEGATIVE:" line. Emphasis: {emphasis}. {notes}\n\nSTORY:\n{__input_script}',
    params: [
      { id: 'target', label: 'Target moment', widget: 'text', section: 'Brief', placeholder: 'opening shot, climax, reveal…', default: 'key scene', promptable: true },
      { id: 'count', label: 'Prompts per run', widget: 'slider', section: 'Brief', default: 3, min: 1, max: 8, step: 1, promptable: true },
      { id: 'detailLevel', label: 'Detail level', widget: 'select', section: 'Brief', default: 'rich', promptable: true,
        options: opts(['minimal', 'Minimal'], ['rich', 'Rich'], ['exhaustive', 'Exhaustive']) },
      { id: 'emphasis', label: 'Emphasis', widget: 'multiselect', section: 'Brief', default: ['composition', 'lighting'], promptable: true,
        options: opts(['composition', 'Composition'], ['lighting', 'Lighting'], ['character', 'Character fidelity'], ['atmosphere', 'Atmosphere'], ['color', 'Color story'], ['texture', 'Texture / materials']) },
      { id: 'notes', label: 'Notes', widget: 'textarea', section: 'Brief', promptable: true },
      variantCountParam,
    ],
  },

  'script-breakdown': {
    type: 'script-breakdown', stage: 'script',
    title: 'Scene Breakdown', subtitle: 'Script → structured scenes', icon: 'list-tree',
    execution: 'banana-text',
    inputs: [{ id: 'script', label: 'Script', type: 'script' }],
    outputs: [{ id: 'scenes', label: 'Scenes', type: 'data' }],
    promptTemplate: 'Break this screenplay into a JSON array of scenes. For each scene: {"slug","location","timeOfDay","characters":[],"props":[],"summary","emotionalBeat","estimatedSeconds"}. Return ONLY JSON.\n\nSCRIPT:\n{__input_script}',
    params: [
      { id: 'granularity', label: 'Granularity', widget: 'select', section: 'Breakdown', default: 'scene',
        options: opts(['scene', 'Per scene'], ['beat', 'Per beat'], ['shot', 'Per implied shot']) },
    ],
  },

  // ═══ STAGE 3 — WORLD (CHARACTERS / LOCATIONS / PROPS) ════════════════════

  'character-profile': {
    type: 'character-profile', stage: 'world',
    title: 'Character', subtitle: 'Author a character bible entry', icon: 'user',
    execution: 'manual',
    inputs: [{ id: 'script', label: 'Script', type: 'script', optional: true }],
    outputs: [{ id: 'character', label: 'Character', type: 'character' }],
    params: [
      { id: 'name', label: 'Name', widget: 'text', section: 'Identity', promptable: true },
      { id: 'role', label: 'Role', widget: 'select', section: 'Identity', default: 'protagonist', promptable: true,
        options: opts(['protagonist', 'Protagonist'], ['antagonist', 'Antagonist'], ['deuteragonist', 'Deuteragonist'], ['mentor', 'Mentor'], ['sidekick', 'Sidekick'], ['love-interest', 'Love interest'], ['ensemble', 'Ensemble'], ['narrator', 'Narrator'], ['extra', 'Background']) },
      { id: 'age', label: 'Age', widget: 'number', section: 'Identity', default: 30, min: 0, max: 120, promptable: true },
      { id: 'gender', label: 'Gender', widget: 'text', section: 'Identity', promptable: true },
      { id: 'appearance', label: 'Appearance', widget: 'textarea', section: 'Look', placeholder: 'Face, hair, build, distinguishing marks…', promptable: true },
      { id: 'wardrobe', label: 'Wardrobe', widget: 'textarea', section: 'Look', promptable: true },
      { id: 'personality', label: 'Personality', widget: 'textarea', section: 'Inner life', promptable: true },
      { id: 'want', label: 'Want (external goal)', widget: 'text', section: 'Inner life', promptable: true },
      { id: 'need', label: 'Need (internal)', widget: 'text', section: 'Inner life', promptable: true },
      { id: 'arc', label: 'Arc', widget: 'textarea', section: 'Inner life', promptable: true },
      { id: 'voiceStyle', label: 'Voice', widget: 'select', section: 'Voice', options: VOICE_STYLES, default: 'natural', promptable: true },
      { id: 'accent', label: 'Accent / speech quirks', widget: 'text', section: 'Voice', promptable: true },
    ],
  },

  'character-sheet-gen': {
    type: 'character-sheet-gen', stage: 'world',
    title: 'Character Sheet', subtitle: 'banana2 turnaround & expressions', icon: 'contact',
    execution: 'banana-image',
    inputs: [
      { id: 'character', label: 'Character', type: 'character', optional: true },
      { id: 'style', label: 'Style', type: 'style', optional: true },
      { id: 'ref', label: 'Face ref', type: 'image', optional: true },
    ],
    outputs: [{ id: 'sheet', label: 'Sheet', type: 'image' }],
    promptTemplate: 'Character reference sheet: {name}, {age} years old. {appearance}. Wearing {wardrobe}. Layout: {layout}. Dominant emotion: {emotion} at {emotionIntensity} intensity. Pose: {pose}. Neutral background, consistent identity across poses, {artStyle} style. {extra}',
    params: [
      { id: 'name', label: 'Name (if no input)', widget: 'text', section: 'Character', promptable: true },
      { id: 'appearance', label: 'Appearance (if no input)', widget: 'textarea', section: 'Character', promptable: true },
      { id: 'layout', label: 'Sheet layout', widget: 'select', section: 'Sheet', default: 'turnaround', promptable: true,
        options: opts(['turnaround', 'Front / side / back turnaround'], ['expressions', '9 facial expressions grid'], ['poses', 'Action pose sheet'], ['closeup', 'Portrait close-up'], ['full-outfits', 'Outfit variations']) },
      { id: 'emotion', label: 'Emotion', widget: 'select', section: 'Performance', default: 'neutral', promptable: true,
        help: 'Generate one version per emotion — they stack on the node',
        options: opts(['neutral', 'Neutral'], ['joy', 'Joy'], ['sadness', 'Sadness'], ['anger', 'Anger'], ['fear', 'Fear'], ['surprise', 'Surprise'], ['disgust', 'Disgust'], ['contempt', 'Contempt'], ['determination', 'Determination'], ['tenderness', 'Tenderness'], ['exhaustion', 'Exhaustion'], ['suspicion', 'Suspicion'], ['awe', 'Awe'], ['shame', 'Shame'], ['pride', 'Pride'], ['longing', 'Longing']) },
      { id: 'emotionIntensity', label: 'Emotion intensity', widget: 'select', section: 'Performance', default: 'moderate', promptable: true,
        options: opts(['subtle', 'Subtle'], ['moderate', 'Moderate'], ['strong', 'Strong'], ['extreme', 'Extreme']) },
      { id: 'pose', label: 'Pose / attitude', widget: 'text', section: 'Performance', placeholder: 'arms crossed, mid-stride, slumped…', promptable: true },
      ...styleParams,
      { id: 'aspectRatio', label: 'Aspect ratio', widget: 'aspect', section: 'Generation', options: ASPECT_RATIOS, default: '16:9' },
      seedParam, variantCountParam,
    ],
  },

  'location-profile': {
    type: 'location-profile', stage: 'world',
    title: 'Location', subtitle: 'Define a place', icon: 'map-pin',
    execution: 'manual',
    inputs: [{ id: 'script', label: 'Script', type: 'script', optional: true }],
    outputs: [{ id: 'location', label: 'Location', type: 'location' }],
    params: [
      { id: 'name', label: 'Name', widget: 'text', section: 'Place', promptable: true },
      { id: 'interior', label: 'Interior / Exterior', widget: 'select', section: 'Place', default: 'ext',
        options: opts(['int', 'Interior'], ['ext', 'Exterior'], ['both', 'Both']), promptable: true },
      { id: 'description', label: 'Description', widget: 'textarea', section: 'Place', promptable: true },
      { id: 'timeOfDay', label: 'Default time', widget: 'select', section: 'Atmosphere', options: TIME_OF_DAY, default: 'golden-hour', promptable: true },
      { id: 'weather', label: 'Weather', widget: 'select', section: 'Atmosphere', options: WEATHER, default: 'clear', promptable: true },
      { id: 'props', label: 'Key props', widget: 'tags', section: 'Set dressing', promptable: true },
      { id: 'soundscape', label: 'Soundscape', widget: 'text', section: 'Atmosphere', placeholder: 'distant traffic, gulls, hum of neon…', promptable: true },
    ],
  },

  'location-plate-gen': {
    type: 'location-plate-gen', stage: 'world',
    title: 'Location Plates', subtitle: 'banana2 establishing views', icon: 'mountain',
    execution: 'banana-image',
    inputs: [
      { id: 'location', label: 'Location', type: 'location', optional: true },
      { id: 'style', label: 'Style', type: 'style', optional: true },
    ],
    outputs: [{ id: 'plate', label: 'Plate', type: 'image' }],
    promptTemplate: 'Establishing plate of {name}: {description}. {timeOfDay}, {weather}. {shotSize} from {angle}, {lens} lens, {lighting} lighting, {artStyle}. {extra}',
    params: [
      { id: 'name', label: 'Location (if no input)', widget: 'text', section: 'Place', promptable: true },
      { id: 'description', label: 'Description (if no input)', widget: 'textarea', section: 'Place', promptable: true },
      { id: 'timeOfDay', label: 'Time of day', widget: 'select', section: 'Atmosphere', options: TIME_OF_DAY, default: 'golden-hour', promptable: true },
      { id: 'weather', label: 'Weather', widget: 'select', section: 'Atmosphere', options: WEATHER, default: 'clear', promptable: true },
      ...cameraParams,
      ...styleParams,
      { id: 'extra', label: 'Extra direction', widget: 'textarea', section: 'Place', promptable: true },
      { id: 'aspectRatio', label: 'Aspect ratio', widget: 'aspect', section: 'Generation', options: ASPECT_RATIOS, default: '16:9' },
      seedParam, variantCountParam,
    ],
  },

  'prop-design': {
    type: 'prop-design', stage: 'world',
    title: 'Prop Design', subtitle: 'banana2 object concepts', icon: 'box',
    execution: 'banana-image',
    inputs: [{ id: 'style', label: 'Style', type: 'style', optional: true }],
    outputs: [{ id: 'prop', label: 'Prop', type: 'image' }],
    promptTemplate: 'Prop design sheet: {name}. {description}. Material: {material}. Condition: {condition}. Multiple angles on neutral background, {artStyle}. {extra}',
    params: [
      { id: 'name', label: 'Prop name', widget: 'text', section: 'Prop', promptable: true },
      { id: 'description', label: 'Description', widget: 'textarea', section: 'Prop', promptable: true },
      { id: 'material', label: 'Materials', widget: 'text', section: 'Prop', promptable: true },
      { id: 'condition', label: 'Condition', widget: 'select', section: 'Prop', default: 'used', promptable: true,
        options: opts(['pristine', 'Pristine / new'], ['used', 'Used / worn'], ['damaged', 'Damaged'], ['ancient', 'Ancient / relic']) },
      { id: 'extra', label: 'Extra direction', widget: 'textarea', section: 'Prop', promptable: true },
      ...styleParams,
      seedParam, variantCountParam,
    ],
  },

  'model3d-import': {
    type: 'model3d-import', stage: 'world',
    title: 'Import 3D Model', subtitle: 'GLB / OBJ real geometry', icon: 'boxes',
    execution: 'import',
    inputs: [],
    outputs: [{ id: 'model', label: 'Model', type: '3d' }],
    params: [
      { id: 'file', label: '3D file (.glb .gltf .obj)', widget: 'file', section: 'Source' },
      { id: 'name', label: 'Object name', widget: 'text', section: 'Source', promptable: true },
      { id: 'description', label: 'What it looks like', widget: 'textarea', section: 'Source',
        placeholder: 'weathered bronze astrolabe, 30cm, engraved rings…',
        help: 'Used in prompts so generations match the real object', promptable: true },
      { id: 'materials', label: 'Materials', widget: 'text', section: 'Source', promptable: true },
      { id: 'scaleRef', label: 'Real-world size', widget: 'text', section: 'Source', placeholder: '30 cm tall', promptable: true },
      { id: 'renderNote', label: 'Placement note', widget: 'textarea', section: 'Usage',
        placeholder: 'hero prop, always on the desk, key light from left…', promptable: true },
    ],
  },

  // ═══ STAGE 4 — STORYBOARD ════════════════════════════════════════════════

  'shotlist-gen': {
    type: 'shotlist-gen', stage: 'storyboard',
    title: 'Shot List', subtitle: 'Scenes → numbered shots', icon: 'list-ordered',
    execution: 'banana-text',
    inputs: [
      { id: 'script', label: 'Script', type: 'script', optional: true },
      { id: 'scenes', label: 'Scenes', type: 'data', optional: true },
    ],
    outputs: [{ id: 'shotlist', label: 'Shot list', type: 'shotlist' }],
    promptTemplate: 'Create a shot list as a JSON array from this script. Pacing: {pacing}. Coverage: {coverage}. Max shots: {maxShots}. Each item: {"shot":"1A","sceneSlug","shotSize","angle","move","lens","description","dialogueCue","durationSeconds","transitionOut"}. Return ONLY JSON.\n\nSCRIPT:\n{__input_script}',
    params: [
      { id: 'pacing', label: 'Pacing', widget: 'select', section: 'Coverage', default: 'balanced', promptable: true,
        options: opts(['slow', 'Slow / contemplative'], ['balanced', 'Balanced'], ['fast', 'Fast / kinetic'], ['music-video', 'Music-video rapid']) },
      { id: 'coverage', label: 'Coverage style', widget: 'select', section: 'Coverage', default: 'classic', promptable: true,
        options: opts(['classic', 'Classic master + coverage'], ['oners', 'Long oners'], ['handheld-doc', 'Handheld documentary'], ['locked', 'Locked-off tableau'], ['pov-heavy', 'POV heavy']) },
      { id: 'maxShots', label: 'Max shots', widget: 'slider', section: 'Coverage', default: 24, min: 4, max: 120, step: 1, promptable: true },
    ],
  },

  'storyboard-frame': {
    type: 'storyboard-frame', stage: 'storyboard',
    title: 'Storyboard Frames', subtitle: 'banana2 draws each shot', icon: 'layout-grid',
    execution: 'banana-image',
    inputs: [
      { id: 'shotlist', label: 'Shot list', type: 'shotlist', optional: true },
      { id: 'characters', label: 'Characters', type: 'character', optional: true, multi: true },
      { id: 'location', label: 'Location', type: 'location', optional: true },
      { id: 'style', label: 'Style', type: 'style', optional: true },
    ],
    outputs: [{ id: 'frame', label: 'Frame', type: 'image' }],
    promptTemplate: 'Storyboard frame, shot {shotNumber}: {action}. {shotSize} from {angle}, {lens}. {lighting} lighting. Style: {boardStyle}. Include {annotations}. {extra}',
    params: [
      { id: 'shotNumber', label: 'Shot #', widget: 'text', section: 'Shot', default: '1A', promptable: true },
      { id: 'action', label: 'Action in frame', widget: 'textarea', section: 'Shot', promptable: true },
      { id: 'boardStyle', label: 'Board style', widget: 'select', section: 'Style', default: 'pencil', promptable: true,
        options: opts(['pencil', 'Pencil sketch'], ['ink', 'Ink linework'], ['toned', 'Toned grayscale'], ['color-rough', 'Color rough'], ['full-color', 'Full color'], ['3d-blockout', '3D blockout']) },
      { id: 'annotations', label: 'Annotations', widget: 'multiselect', section: 'Style', promptable: true,
        options: opts(['arrows', 'Motion arrows'], ['frame-lines', 'Frame lines'], ['shot-number', 'Shot number'], ['lens-notes', 'Lens notes'], ['none', 'None']), default: ['arrows', 'shot-number'] },
      ...cameraParams,
      { id: 'extra', label: 'Extra direction', widget: 'textarea', section: 'Shot', promptable: true },
      { id: 'aspectRatio', label: 'Aspect ratio', widget: 'aspect', section: 'Generation', options: ASPECT_RATIOS, default: '16:9' },
      seedParam, variantCountParam,
    ],
  },

  'animatic': {
    type: 'animatic', stage: 'storyboard',
    title: 'Animatic', subtitle: 'Timed frame sequence', icon: 'gallery-horizontal',
    execution: 'compose',
    inputs: [
      { id: 'frames', label: 'Frames', type: 'image', multi: true },
      { id: 'shotlist', label: 'Shot list', type: 'shotlist', optional: true },
      { id: 'scratch', label: 'Scratch audio', type: 'audio', optional: true },
    ],
    outputs: [{ id: 'animatic', label: 'Animatic', type: 'video' }],
    params: [
      { id: 'defaultShotSeconds', label: 'Default shot length (s)', widget: 'slider', section: 'Timing', default: 2.5, min: 0.5, max: 10, step: 0.25 },
      { id: 'fps', label: 'FPS', widget: 'select', section: 'Timing', default: '24',
        options: opts(['12', '12'], ['24', '24'], ['25', '25'], ['30', '30']) },
      { id: 'kenBurns', label: 'Ken Burns drift', widget: 'toggle', section: 'Motion', default: true },
      { id: 'showShotNumbers', label: 'Burn-in shot numbers', widget: 'toggle', section: 'Overlay', default: true },
    ],
  },

  // ═══ STAGE 5 — VISUALS ═══════════════════════════════════════════════════

  'image-import': {
    type: 'image-import', stage: 'visual',
    title: 'Import Image', subtitle: 'Bring your own frame', icon: 'image-plus',
    execution: 'import',
    inputs: [],
    outputs: [{ id: 'image', label: 'Image', type: 'image' }],
    params: [{ id: 'file', label: 'Image file', widget: 'file', section: 'Source' }],
  },

  'sketch-gen': {
    type: 'sketch-gen', stage: 'visual',
    title: 'Rough Sketch', subtitle: 'Explore composition fast', icon: 'pencil',
    execution: 'banana-image',
    inputs: [
      { id: 'prompt', label: 'Prompt', type: 'text', optional: true },
      { id: 'script', label: 'Script', type: 'script', optional: true },
      { id: 'style', label: 'Style', type: 'style', optional: true },
    ],
    outputs: [{ id: 'sketch', label: 'Sketch', type: 'image' }],
    promptTemplate: 'Loose {sketchStyle} sketch exploring composition: {subject}. {shotSize} from {angle}. Focus on {focus} — rough, energetic linework, no polish, values only. {extra}',
    params: [
      { id: 'subject', label: 'Subject / moment', widget: 'textarea', section: 'Sketch', promptable: true },
      { id: 'sketchStyle', label: 'Sketch style', widget: 'select', section: 'Sketch', default: 'pencil', promptable: true,
        options: opts(['pencil', 'Pencil rough'], ['charcoal', 'Charcoal'], ['ink-thumbnail', 'Ink thumbnail'], ['marker', 'Marker layout'], ['digital-blockin', 'Digital block-in'], ['gesture', 'Gesture lines']) },
      { id: 'focus', label: 'Explore', widget: 'multiselect', section: 'Sketch', default: ['composition'], promptable: true,
        options: opts(['composition', 'Composition'], ['silhouette', 'Silhouettes'], ['values', 'Value masses'], ['perspective', 'Perspective'], ['staging', 'Staging / blocking']) },
      { id: 'shotSize', label: 'Shot size', widget: 'select', section: 'Camera', options: CAMERA_SHOTS, default: 'wide', promptable: true },
      { id: 'angle', label: 'Angle', widget: 'select', section: 'Camera', options: CAMERA_ANGLES, default: 'eye-level', promptable: true },
      { id: 'extra', label: 'Extra direction', widget: 'textarea', section: 'Sketch', promptable: true },
      { id: 'aspectRatio', label: 'Aspect ratio', widget: 'aspect', section: 'Generation', options: ASPECT_RATIOS, default: '16:9' },
      seedParam, variantCountParam,
    ],
  },

  'keyframe-gen': {
    type: 'keyframe-gen', stage: 'visual',
    title: 'Key Visual', subtitle: 'banana2 hero frame', icon: 'sparkles',
    execution: 'banana-image',
    inputs: [
      { id: 'prompt', label: 'Prompt', type: 'text', optional: true },
      { id: 'sketch', label: 'Sketch', type: 'image', optional: true },
      { id: 'board', label: 'Storyboard frame', type: 'image', optional: true },
      { id: 'characters', label: 'Characters', type: 'character', optional: true, multi: true },
      { id: 'location', label: 'Location', type: 'location', optional: true },
      { id: 'models', label: '3D props', type: '3d', optional: true, multi: true },
      { id: 'style', label: 'Style', type: 'style', optional: true },
      { id: 'palette', label: 'Palette', type: 'palette', optional: true },
    ],
    outputs: [{ id: 'image', label: 'Image', type: 'image' }],
    promptTemplate: '{__input_prompt} {subject}. Props present: {__input_models}. {shotSize} from {angle}, {lens} lens, {depthOfField} depth of field. Focus on {focusSubject}. {lighting} lighting, {mood} mood, {artStyle}. {colorNotes}. {extra}',
    params: [
      { id: 'subject', label: 'Subject / action', widget: 'textarea', section: 'Prompt', promptable: true },
      { id: 'extra', label: 'Details', widget: 'textarea', section: 'Prompt', promptable: true },
      { id: 'negative', label: 'Avoid', widget: 'text', section: 'Prompt', placeholder: 'text, watermark, extra fingers…', promptable: true },
      { id: 'focusSubject', label: 'Focus on', widget: 'text', section: 'Camera', placeholder: 'her eyes, the letter in his hand…', default: 'the main subject', promptable: true },
      ...cameraParams,
      ...styleParams,
      { id: 'aspectRatio', label: 'Aspect ratio', widget: 'aspect', section: 'Generation', options: ASPECT_RATIOS, default: '16:9' },
      { id: 'quality', label: 'Detail level', widget: 'select', section: 'Generation', default: 'high',
        options: opts(['draft', 'Draft'], ['high', 'High'], ['ultra', 'Ultra']) },
      seedParam, variantCountParam,
    ],
  },

  'image-edit': {
    type: 'image-edit', stage: 'visual',
    title: 'AI Edit', subtitle: 'banana2 modifies any part', icon: 'wand',
    execution: 'banana-image-edit',
    inputs: [
      { id: 'image', label: 'Image', type: 'image' },
      { id: 'reference', label: 'Reference', type: 'image', optional: true },
    ],
    outputs: [{ id: 'image', label: 'Image', type: 'image' }],
    promptTemplate: '{operation}: {instruction}. Preserve everything else exactly. Keep original style, lighting and composition. {strengthNote}',
    params: [
      { id: 'operation', label: 'Operation', widget: 'select', section: 'Edit', default: 'modify', promptable: true,
        options: opts(
          ['modify', 'Modify region'], ['add', 'Add element'], ['remove', 'Remove element'],
          ['replace-bg', 'Replace background'], ['restyle', 'Restyle whole image'],
          ['relight', 'Relight'], ['recolor', 'Recolor'], ['outpaint', 'Extend / outpaint'],
          ['face-fix', 'Fix face'], ['hands-fix', 'Fix hands'], ['detail-up', 'Enhance details'],
          ['age', 'Age / de-age subject'], ['weather', 'Change weather'], ['time', 'Change time of day'],
          ['expression', 'Change expression'], ['pose', 'Adjust pose'], ['cleanup', 'Cleanup artifacts'],
        ) },
      { id: 'instruction', label: 'Instruction', widget: 'textarea', section: 'Edit', placeholder: 'Turn the red coat into deep navy…', promptable: true },
      { id: 'strength', label: 'Edit strength', widget: 'slider', section: 'Edit', default: 0.7, min: 0.1, max: 1, step: 0.05 },
      { id: 'preserveIdentity', label: 'Preserve identity', widget: 'toggle', section: 'Edit', default: true },
      seedParam, variantCountParam,
    ],
  },

  'upscale': {
    type: 'upscale', stage: 'visual',
    title: 'Upscale', subtitle: 'Resolution & detail boost', icon: 'maximize',
    execution: 'banana-image-edit',
    inputs: [{ id: 'image', label: 'Image', type: 'image' }],
    outputs: [{ id: 'image', label: 'Image', type: 'image' }],
    promptTemplate: 'Upscale this image to higher resolution. Enhance fine detail ({detailBoost} boost), sharpen ({sharpen}), denoise ({denoise}). Do not change content or composition.',
    params: [
      { id: 'factor', label: 'Scale factor', widget: 'select', section: 'Upscale', default: '2',
        options: opts(['1.5', '1.5×'], ['2', '2×'], ['4', '4×']) },
      { id: 'detailBoost', label: 'Detail boost', widget: 'slider', section: 'Upscale', default: 0.5, min: 0, max: 1, step: 0.05, promptable: true },
      { id: 'sharpen', label: 'Sharpen', widget: 'slider', section: 'Upscale', default: 0.3, min: 0, max: 1, step: 0.05, promptable: true },
      { id: 'denoise', label: 'Denoise', widget: 'slider', section: 'Upscale', default: 0.2, min: 0, max: 1, step: 0.05, promptable: true },
      { id: 'faceRestore', label: 'Face restore', widget: 'toggle', section: 'Upscale', default: true },
    ],
  },

  'color-grade': {
    type: 'color-grade', stage: 'visual',
    title: 'Color Grade', subtitle: 'Look development', icon: 'sliders',
    execution: 'banana-image-edit',
    inputs: [
      { id: 'image', label: 'Image', type: 'image' },
      { id: 'palette', label: 'Palette', type: 'palette', optional: true },
    ],
    outputs: [{ id: 'image', label: 'Image', type: 'image' }],
    promptTemplate: 'Color grade this image: {look} look. Exposure {exposure}, contrast {contrast}, saturation {saturation}, temperature {temperature}, tint {tint}. Shadows toward {shadowColor}, highlights toward {highlightColor}. Film grain {grain}, vignette {vignette}. Keep content identical.',
    params: [
      { id: 'look', label: 'Look preset', widget: 'select', section: 'Look', default: 'cinematic-teal-orange', promptable: true,
        options: opts(
          ['cinematic-teal-orange', 'Teal & Orange'], ['bleach-bypass', 'Bleach bypass'],
          ['day-for-night', 'Day for night'], ['pastel', 'Pastel'], ['noir-bw', 'Noir B&W'],
          ['golden', 'Golden warm'], ['cool-thriller', 'Cool thriller'], ['vintage-70s', 'Vintage 70s'],
          ['vhs', 'VHS'], ['cross-process', 'Cross-process'], ['natural', 'Natural / none'],
        ) },
      { id: 'exposure', label: 'Exposure', widget: 'slider', section: 'Balance', default: 0, min: -2, max: 2, step: 0.1, promptable: true },
      { id: 'contrast', label: 'Contrast', widget: 'slider', section: 'Balance', default: 0, min: -1, max: 1, step: 0.05, promptable: true },
      { id: 'saturation', label: 'Saturation', widget: 'slider', section: 'Balance', default: 0, min: -1, max: 1, step: 0.05, promptable: true },
      { id: 'temperature', label: 'Temperature', widget: 'slider', section: 'Balance', default: 0, min: -1, max: 1, step: 0.05, promptable: true },
      { id: 'tint', label: 'Tint', widget: 'slider', section: 'Balance', default: 0, min: -1, max: 1, step: 0.05, promptable: true },
      { id: 'shadowColor', label: 'Shadow tint', widget: 'color', section: 'Split tone', default: '#1e3a5f', promptable: true },
      { id: 'highlightColor', label: 'Highlight tint', widget: 'color', section: 'Split tone', default: '#ffd9a0', promptable: true },
      { id: 'grain', label: 'Grain', widget: 'slider', section: 'Texture', default: 0.15, min: 0, max: 1, step: 0.05, promptable: true },
      { id: 'vignette', label: 'Vignette', widget: 'slider', section: 'Texture', default: 0.2, min: 0, max: 1, step: 0.05, promptable: true },
    ],
  },

  // ═══ STAGE 6 — MOTION ════════════════════════════════════════════════════

  'video-import': {
    type: 'video-import', stage: 'motion',
    title: 'Import Video', subtitle: 'Bring your own footage', icon: 'file-video',
    execution: 'import',
    inputs: [],
    outputs: [{ id: 'video', label: 'Video', type: 'video' }],
    params: [
      { id: 'file', label: 'Video file', widget: 'file', section: 'Source' },
      { id: 'trimIn', label: 'Trim in (s)', widget: 'number', section: 'Trim', default: 0, min: 0 },
      { id: 'trimOut', label: 'Trim out (s)', widget: 'number', section: 'Trim', default: 0, min: 0, help: '0 = full length' },
    ],
  },

  'image-to-video': {
    type: 'image-to-video', stage: 'motion',
    title: 'Animate Image', subtitle: 'Image → motion clip', icon: 'play',
    execution: 'banana-image-edit',
    inputs: [
      { id: 'image', label: 'Image', type: 'image' },
      { id: 'endImage', label: 'End frame', type: 'image', optional: true },
    ],
    outputs: [{ id: 'video', label: 'Clip', type: 'video' }],
    promptTemplate: 'Animate this frame: {motionPrompt}. Camera: {cameraMove} at {moveSpeed} speed. Subject motion: {subjectMotion}. Ambient motion: {ambient}. Duration {duration}s, {fps} fps. Loop: {loop}.',
    params: [
      { id: 'motionPrompt', label: 'Motion description', widget: 'textarea', section: 'Motion', placeholder: 'Her scarf lifts in the wind as the camera pushes in…', promptable: true },
      { id: 'cameraMove', label: 'Camera move', widget: 'select', section: 'Camera', options: CAMERA_MOVES, default: 'dolly-in', promptable: true },
      { id: 'moveSpeed', label: 'Move speed', widget: 'select', section: 'Camera', default: 'slow', promptable: true,
        options: opts(['very-slow', 'Very slow'], ['slow', 'Slow'], ['medium', 'Medium'], ['fast', 'Fast']) },
      { id: 'subjectMotion', label: 'Subject motion', widget: 'select', section: 'Motion', default: 'subtle', promptable: true,
        options: opts(['frozen', 'Frozen (camera only)'], ['subtle', 'Subtle life'], ['normal', 'Normal action'], ['dynamic', 'Dynamic action']) },
      { id: 'ambient', label: 'Ambient motion', widget: 'multiselect', section: 'Motion', promptable: true, default: ['atmosphere'],
        options: opts(['wind', 'Wind in hair/cloth'], ['water', 'Water movement'], ['fire', 'Fire flicker'], ['atmosphere', 'Dust / particles'], ['crowd', 'Background crowd'], ['rain', 'Rain'], ['snow', 'Snow'], ['none', 'None']) },
      { id: 'duration', label: 'Duration (s)', widget: 'slider', section: 'Timing', default: 5, min: 2, max: 10, step: 1, promptable: true },
      { id: 'fps', label: 'FPS', widget: 'select', section: 'Timing', default: '24', options: opts(['24', '24'], ['25', '25'], ['30', '30'], ['60', '60']), promptable: true },
      { id: 'loop', label: 'Seamless loop', widget: 'toggle', section: 'Timing', default: false, promptable: true },
      seedParam, variantCountParam,
    ],
  },

  'motion-direction': {
    type: 'motion-direction', stage: 'motion',
    title: 'Motion Direction', subtitle: 'banana2 writes motion specs', icon: 'move',
    execution: 'banana-text',
    inputs: [
      { id: 'shotlist', label: 'Shot list', type: 'shotlist', optional: true },
      { id: 'frame', label: 'Frame', type: 'image', optional: true },
    ],
    outputs: [{ id: 'spec', label: 'Motion spec', type: 'data' }],
    promptTemplate: 'For each shot, write a precise motion-generation prompt (camera move, subject action, ambient motion, speed, easing). Style: {intensity} intensity, {handfeel}. Return JSON array [{"shot","motionPrompt","cameraMove","durationSeconds"}]. Shots:\n{__input_shotlist}',
    params: [
      { id: 'intensity', label: 'Intensity', widget: 'select', section: 'Direction', default: 'medium', promptable: true,
        options: opts(['minimal', 'Minimal'], ['medium', 'Medium'], ['high', 'High energy']) },
      { id: 'handfeel', label: 'Feel', widget: 'select', section: 'Direction', default: 'smooth', promptable: true,
        options: opts(['smooth', 'Smooth gimbal'], ['organic', 'Organic handheld'], ['mechanical', 'Mechanical precise']) },
    ],
  },

  'frame-interpolate': {
    type: 'frame-interpolate', stage: 'motion',
    title: 'Interpolate', subtitle: 'Smooth / slow-mo', icon: 'gauge',
    execution: 'local',
    inputs: [{ id: 'video', label: 'Video', type: 'video' }],
    outputs: [{ id: 'video', label: 'Video', type: 'video' }],
    params: [
      { id: 'targetFps', label: 'Target FPS', widget: 'select', section: 'Interpolation', default: '60',
        options: opts(['30', '30'], ['48', '48'], ['60', '60'], ['120', '120']) },
      { id: 'slowmo', label: 'Slow-motion factor', widget: 'select', section: 'Interpolation', default: '1',
        options: opts(['1', '1× (none)'], ['2', '2×'], ['4', '4×'], ['8', '8×']) },
    ],
  },

  'stabilize': {
    type: 'stabilize', stage: 'motion',
    title: 'Stabilize', subtitle: 'Remove shake', icon: 'anchor',
    execution: 'local',
    inputs: [{ id: 'video', label: 'Video', type: 'video' }],
    outputs: [{ id: 'video', label: 'Video', type: 'video' }],
    params: [
      { id: 'strength', label: 'Strength', widget: 'slider', section: 'Stabilize', default: 0.5, min: 0, max: 1, step: 0.05 },
      { id: 'cropMode', label: 'Crop mode', widget: 'select', section: 'Stabilize', default: 'auto',
        options: opts(['auto', 'Auto crop'], ['fixed', 'Fixed 5% crop'], ['none', 'No crop (borders)']) },
    ],
  },

  // ═══ STAGE 7 — AUDIO ═════════════════════════════════════════════════════

  'audio-import': {
    type: 'audio-import', stage: 'audio',
    title: 'Import Audio', subtitle: 'Music, VO or SFX file', icon: 'file-audio',
    execution: 'import',
    inputs: [],
    outputs: [{ id: 'audio', label: 'Audio', type: 'audio' }],
    params: [
      { id: 'file', label: 'Audio file', widget: 'file', section: 'Source' },
      { id: 'kind', label: 'Kind', widget: 'select', section: 'Source', default: 'music',
        options: opts(['music', 'Music'], ['vo', 'Voice-over'], ['sfx', 'SFX'], ['ambience', 'Ambience']) },
      { id: 'gain', label: 'Gain (dB)', widget: 'slider', section: 'Level', default: 0, min: -24, max: 12, step: 0.5 },
    ],
  },

  'dialogue-tts': {
    type: 'dialogue-tts', stage: 'audio',
    title: 'Dialogue / VO', subtitle: 'Realistic speech synthesis', icon: 'mic',
    execution: 'banana-text',
    inputs: [
      { id: 'script', label: 'Script', type: 'script', optional: true },
      { id: 'character', label: 'Character', type: 'character', optional: true },
    ],
    outputs: [{ id: 'audio', label: 'Speech', type: 'audio' }],
    promptTemplate: 'Prepare a TTS performance script: mark up this dialogue with pacing, pauses (…), emphasis, breaths and emotional cues for a {voiceStyle} voice, {emotion} read, {pace} pace, {language}. Text: {text}',
    params: [
      { id: 'text', label: 'Line(s) to speak', widget: 'textarea', section: 'Text', promptable: true },
      { id: 'voiceStyle', label: 'Voice style', widget: 'select', section: 'Voice', options: VOICE_STYLES, default: 'natural', promptable: true },
      { id: 'language', label: 'Language', widget: 'select', section: 'Voice', options: LANGUAGES, default: 'en', promptable: true },
      { id: 'emotion', label: 'Emotion', widget: 'select', section: 'Performance', default: 'neutral', promptable: true,
        options: opts(['neutral', 'Neutral'], ['happy', 'Happy'], ['sad', 'Sad'], ['angry', 'Angry'], ['afraid', 'Afraid'], ['tender', 'Tender'], ['excited', 'Excited'], ['sarcastic', 'Sarcastic'], ['weary', 'Weary']) },
      { id: 'pace', label: 'Pace', widget: 'select', section: 'Performance', default: 'natural', promptable: true,
        options: opts(['very-slow', 'Very slow'], ['slow', 'Slow'], ['natural', 'Natural'], ['brisk', 'Brisk'], ['rapid', 'Rapid']) },
      { id: 'pitch', label: 'Pitch shift', widget: 'slider', section: 'Performance', default: 0, min: -12, max: 12, step: 1 },
      variantCountParam,
    ],
  },

  'music-gen': {
    type: 'music-gen', stage: 'audio',
    title: 'Music', subtitle: 'Score & songs brief', icon: 'music',
    execution: 'banana-text',
    inputs: [{ id: 'script', label: 'Script / mood', type: 'script', optional: true }],
    outputs: [{ id: 'audio', label: 'Music', type: 'audio' }],
    promptTemplate: 'Write a detailed music generation brief: {genre} at {bpm} BPM in {key}. Mood: {mood}. Instrumentation: {instruments}. Structure: {structure}. Duration {duration}s. Reference feel: {reference}. Describe intro/build/peak/outro with timestamps.',
    params: [
      { id: 'genre', label: 'Genre', widget: 'select', section: 'Music', options: MUSIC_GENRES, default: 'orchestral', promptable: true },
      { id: 'mood', label: 'Mood', widget: 'select', section: 'Music', options: MOODS, default: 'epic', promptable: true },
      { id: 'bpm', label: 'BPM', widget: 'slider', section: 'Music', default: 100, min: 40, max: 200, step: 1, promptable: true },
      { id: 'key', label: 'Key', widget: 'select', section: 'Music', default: 'D minor', promptable: true,
        options: opts(['C major', 'C major'], ['G major', 'G major'], ['D major', 'D major'], ['A minor', 'A minor'], ['D minor', 'D minor'], ['E minor', 'E minor'], ['F# minor', 'F# minor'], ['Bb major', 'B♭ major']) },
      { id: 'instruments', label: 'Instrumentation', widget: 'tags', section: 'Music', promptable: true },
      { id: 'structure', label: 'Structure', widget: 'select', section: 'Music', default: 'build', promptable: true,
        options: opts(['loop', 'Ambient loop'], ['build', 'Slow build'], ['verse-chorus', 'Verse-chorus'], ['sting', 'Sting / logo'], ['underscore', 'Underscore']) },
      { id: 'duration', label: 'Duration (s)', widget: 'slider', section: 'Music', default: 60, min: 5, max: 300, step: 5, promptable: true },
      { id: 'reference', label: 'Reference feel', widget: 'text', section: 'Music', placeholder: 'like a Sicario-era Jóhannsson pulse…', promptable: true },
      variantCountParam,
    ],
  },

  'sfx-gen': {
    type: 'sfx-gen', stage: 'audio',
    title: 'SFX & Ambience', subtitle: 'Sound design brief', icon: 'waves',
    execution: 'banana-text',
    inputs: [{ id: 'shotlist', label: 'Shot list', type: 'shotlist', optional: true }],
    outputs: [{ id: 'audio', label: 'SFX', type: 'audio' }],
    promptTemplate: 'Design a sound-effects cue list for: {description}. Category: {category}. Perspective: {perspective}. Intensity {intensity}. Return JSON [{"cue","description","durationSeconds","layer"}].',
    params: [
      { id: 'description', label: 'What we hear', widget: 'textarea', section: 'SFX', promptable: true },
      { id: 'category', label: 'Category', widget: 'select', section: 'SFX', default: 'ambience', promptable: true,
        options: opts(['ambience', 'Ambience bed'], ['foley', 'Foley'], ['impact', 'Impacts / hits'], ['whoosh', 'Whooshes'], ['ui', 'UI / tech'], ['nature', 'Nature'], ['urban', 'Urban'], ['scifi', 'Sci-fi'], ['horror', 'Horror texture']) },
      { id: 'perspective', label: 'Perspective', widget: 'select', section: 'SFX', default: 'medium', promptable: true,
        options: opts(['close', 'Close / intimate'], ['medium', 'Medium'], ['distant', 'Distant']) },
      { id: 'intensity', label: 'Intensity', widget: 'slider', section: 'SFX', default: 0.5, min: 0, max: 1, step: 0.05, promptable: true },
      variantCountParam,
    ],
  },

  'audio-mix': {
    type: 'audio-mix', stage: 'audio',
    title: 'Mix', subtitle: 'Balance all audio layers', icon: 'sliders-horizontal',
    execution: 'compose',
    inputs: [
      { id: 'dialogue', label: 'Dialogue', type: 'audio', optional: true, multi: true },
      { id: 'music', label: 'Music', type: 'audio', optional: true, multi: true },
      { id: 'sfx', label: 'SFX', type: 'audio', optional: true, multi: true },
    ],
    outputs: [{ id: 'mix', label: 'Mix', type: 'audio' }],
    params: [
      { id: 'dialogueLevel', label: 'Dialogue (dB)', widget: 'slider', section: 'Levels', default: 0, min: -24, max: 6, step: 0.5 },
      { id: 'musicLevel', label: 'Music (dB)', widget: 'slider', section: 'Levels', default: -12, min: -36, max: 6, step: 0.5 },
      { id: 'sfxLevel', label: 'SFX (dB)', widget: 'slider', section: 'Levels', default: -8, min: -36, max: 6, step: 0.5 },
      { id: 'ducking', label: 'Auto-duck music under dialogue', widget: 'toggle', section: 'Dynamics', default: true },
      { id: 'duckAmount', label: 'Duck amount (dB)', widget: 'slider', section: 'Dynamics', default: -9, min: -24, max: 0, step: 1 },
      { id: 'loudnessTarget', label: 'Loudness target', widget: 'select', section: 'Master', default: '-14',
        options: opts(['-14', '-14 LUFS (streaming)'], ['-16', '-16 LUFS (podcast)'], ['-23', '-23 LUFS (broadcast)'], ['-11', '-11 LUFS (loud social)']) },
      { id: 'limiter', label: 'True-peak limiter', widget: 'toggle', section: 'Master', default: true },
    ],
  },

  // ═══ STAGE 8 — ASSEMBLY / MONTAGE ════════════════════════════════════════

  'sequence': {
    type: 'sequence', stage: 'assembly',
    title: 'Sequence', subtitle: 'Order clips into a cut', icon: 'film',
    execution: 'compose',
    inputs: [
      { id: 'clips', label: 'Clips', type: 'video', multi: true },
      { id: 'mix', label: 'Audio mix', type: 'audio', optional: true },
      { id: 'shotlist', label: 'Shot list', type: 'shotlist', optional: true },
    ],
    outputs: [{ id: 'timeline', label: 'Timeline', type: 'timeline' }],
    params: [
      { id: 'orderMode', label: 'Ordering', widget: 'select', section: 'Cut', default: 'shotlist',
        options: opts(['shotlist', 'Follow shot list'], ['manual', 'Manual order'], ['beat-sync', 'Sync cuts to music beats']) },
      { id: 'defaultTransition', label: 'Default transition', widget: 'select', section: 'Cut', options: TRANSITIONS, default: 'cut' },
      { id: 'transitionDuration', label: 'Transition length (s)', widget: 'slider', section: 'Cut', default: 0.5, min: 0.1, max: 3, step: 0.1 },
      { id: 'pacingCurve', label: 'Pacing curve', widget: 'select', section: 'Rhythm', default: 'accelerate',
        options: opts(['even', 'Even'], ['accelerate', 'Accelerating'], ['decelerate', 'Decelerating'], ['wave', 'Wave (tension-release)']) },
      { id: 'holdFirst', label: 'Hold first shot (s)', widget: 'slider', section: 'Rhythm', default: 3, min: 0, max: 10, step: 0.5 },
      { id: 'holdLast', label: 'Hold last shot (s)', widget: 'slider', section: 'Rhythm', default: 3, min: 0, max: 10, step: 0.5 },
    ],
  },

  'montage-notes': {
    type: 'montage-notes', stage: 'assembly',
    title: 'Edit Notes', subtitle: 'banana2 reviews the cut', icon: 'clipboard-check',
    execution: 'banana-text',
    inputs: [{ id: 'timeline', label: 'Timeline', type: 'timeline' }],
    outputs: [{ id: 'notes', label: 'Notes', type: 'text' }],
    promptTemplate: 'Act as a senior film editor. Review this cut structure and give {depth} notes on rhythm, continuity, emotional flow and where to trim. Focus: {focus}. Timeline: {__input_timeline}',
    params: [
      { id: 'depth', label: 'Depth', widget: 'select', section: 'Review', default: 'detailed', promptable: true,
        options: opts(['quick', 'Quick pass'], ['detailed', 'Detailed'], ['frame-level', 'Frame-level']) },
      { id: 'focus', label: 'Focus', widget: 'multiselect', section: 'Review', promptable: true, default: ['rhythm', 'emotion'],
        options: opts(['rhythm', 'Rhythm'], ['continuity', 'Continuity'], ['emotion', 'Emotional arc'], ['clarity', 'Story clarity'], ['hooks', 'Social hooks / retention']) },
    ],
  },

  'subtitle-gen': {
    type: 'subtitle-gen', stage: 'assembly',
    title: 'Subtitles', subtitle: 'Captions & translations', icon: 'captions',
    execution: 'banana-text',
    inputs: [
      { id: 'script', label: 'Script', type: 'script', optional: true },
      { id: 'timeline', label: 'Timeline', type: 'timeline', optional: true },
    ],
    outputs: [{ id: 'subtitles', label: 'Subtitles', type: 'subtitle' }],
    promptTemplate: 'Create SRT subtitles from this dialogue. Max {maxChars} chars/line, {maxLines} lines per cue, reading speed ≤ {cps} chars/sec. Language: {language}. Style: {styleNote}. Also translate to: {translations}. Script: {__input_script}',
    params: [
      { id: 'language', label: 'Primary language', widget: 'select', section: 'Text', options: LANGUAGES, default: 'en', promptable: true },
      { id: 'translations', label: 'Also translate to', widget: 'multiselect', section: 'Text', options: LANGUAGES, default: [], promptable: true },
      { id: 'maxChars', label: 'Max chars / line', widget: 'slider', section: 'Layout', default: 38, min: 20, max: 60, step: 1, promptable: true },
      { id: 'maxLines', label: 'Max lines / cue', widget: 'select', section: 'Layout', default: '2', options: opts(['1', '1'], ['2', '2']), promptable: true },
      { id: 'cps', label: 'Reading speed (cps)', widget: 'slider', section: 'Layout', default: 17, min: 10, max: 25, step: 1, promptable: true },
      { id: 'styleNote', label: 'Style', widget: 'select', section: 'Text', default: 'verbatim', promptable: true,
        options: opts(['verbatim', 'Verbatim'], ['clean', 'Clean (no ums)'], ['sdh', 'SDH (sound cues)'], ['karaoke', 'Word-by-word karaoke']) },
    ],
  },

  'caption-style': {
    type: 'caption-style', stage: 'assembly',
    title: 'Caption Style', subtitle: 'Burn-in look', icon: 'type',
    execution: 'manual',
    inputs: [{ id: 'subtitles', label: 'Subtitles', type: 'subtitle' }],
    outputs: [{ id: 'subtitles', label: 'Styled subs', type: 'subtitle' }],
    params: [
      { id: 'font', label: 'Font', widget: 'select', section: 'Type', default: 'inter',
        options: opts(['inter', 'Inter'], ['montserrat', 'Montserrat'], ['bebas', 'Bebas Neue'], ['roboto-mono', 'Roboto Mono'], ['playfair', 'Playfair Display'], ['comic', 'Comic style']) },
      { id: 'size', label: 'Size', widget: 'slider', section: 'Type', default: 42, min: 18, max: 96, step: 1 },
      { id: 'weight', label: 'Weight', widget: 'select', section: 'Type', default: '700',
        options: opts(['400', 'Regular'], ['600', 'Semibold'], ['700', 'Bold'], ['900', 'Black']) },
      { id: 'fill', label: 'Fill', widget: 'color', section: 'Color', default: '#ffffff' },
      { id: 'outline', label: 'Outline', widget: 'color', section: 'Color', default: '#000000' },
      { id: 'outlineWidth', label: 'Outline width', widget: 'slider', section: 'Color', default: 2, min: 0, max: 8, step: 0.5 },
      { id: 'background', label: 'Background box', widget: 'toggle', section: 'Color', default: false },
      { id: 'position', label: 'Position', widget: 'select', section: 'Layout', default: 'bottom',
        options: opts(['bottom', 'Bottom'], ['center', 'Center'], ['top', 'Top'], ['safe-social', 'Social-safe (above UI)']) },
      { id: 'animation', label: 'Animation', widget: 'select', section: 'Motion', default: 'pop',
        options: opts(['none', 'None'], ['pop', 'Pop-in'], ['fade', 'Fade'], ['slide', 'Slide up'], ['karaoke', 'Karaoke highlight'], ['typewriter', 'Typewriter']) },
    ],
  },

  'overlay-text': {
    type: 'overlay-text', stage: 'assembly',
    title: 'Titles & Overlays', subtitle: 'Title cards, lower thirds', icon: 'heading',
    execution: 'manual',
    inputs: [{ id: 'timeline', label: 'Timeline', type: 'timeline', optional: true }],
    outputs: [{ id: 'overlay', label: 'Overlay', type: 'data' }],
    params: [
      { id: 'kind', label: 'Kind', widget: 'select', section: 'Overlay', default: 'title',
        options: opts(['title', 'Title card'], ['lower-third', 'Lower third'], ['end-card', 'End card / CTA'], ['watermark', 'Watermark'], ['countdown', 'Countdown'], ['location-tag', 'Location tag']) },
      { id: 'text', label: 'Text', widget: 'textarea', section: 'Overlay' },
      { id: 'inTime', label: 'In (s)', widget: 'number', section: 'Timing', default: 0, min: 0 },
      { id: 'duration', label: 'Duration (s)', widget: 'number', section: 'Timing', default: 3, min: 0.5 },
      { id: 'animation', label: 'Animation', widget: 'select', section: 'Motion', default: 'fade',
        options: opts(['none', 'None'], ['fade', 'Fade'], ['slide', 'Slide'], ['scale', 'Scale'], ['blur', 'Blur-in'], ['tracking', 'Letter tracking']) },
    ],
  },

  // ═══ STAGE 9 — DELIVERY ══════════════════════════════════════════════════

  'format-profile': {
    type: 'format-profile', stage: 'delivery',
    title: 'Format Profile', subtitle: 'Per-platform master', icon: 'proportions',
    execution: 'compose',
    inputs: [{ id: 'timeline', label: 'Timeline', type: 'timeline' }],
    outputs: [{ id: 'format', label: 'Format', type: 'format' }],
    params: [
      { id: 'platform', label: 'Platform', widget: 'select', section: 'Target', default: 'youtube',
        options: opts(['youtube', 'YouTube 16:9'], ['youtube-shorts', 'YouTube Shorts 9:16'], ['tiktok', 'TikTok 9:16'], ['instagram-reel', 'Instagram Reels 9:16'], ['instagram-feed', 'Instagram feed 4:5'], ['instagram-square', 'Instagram 1:1'], ['x', 'X / Twitter 16:9'], ['cinema', 'Cinema 2.39:1'], ['broadcast', 'Broadcast 16:9'], ['custom', 'Custom']) },
      { id: 'resolution', label: 'Resolution', widget: 'select', section: 'Video', default: '1080',
        options: opts(['720', '720p'], ['1080', '1080p'], ['1440', '1440p'], ['2160', '4K UHD']) },
      { id: 'fps', label: 'FPS', widget: 'select', section: 'Video', default: '30',
        options: opts(['24', '24'], ['25', '25'], ['30', '30'], ['50', '50'], ['60', '60']) },
      { id: 'reframeMode', label: 'Reframe mode', widget: 'select', section: 'Video', default: 'smart',
        options: opts(['smart', 'Smart subject tracking'], ['center', 'Center crop'], ['letterbox', 'Letterbox'], ['blur-pad', 'Blurred pad']) },
      { id: 'maxDuration', label: 'Max duration (s)', widget: 'number', section: 'Target', default: 0, min: 0, help: '0 = no limit; TikTok ≤ 600, Shorts ≤ 60' },
      { id: 'burnCaptions', label: 'Burn-in captions', widget: 'toggle', section: 'Captions', default: true },
      { id: 'safeMargins', label: 'Platform-safe margins', widget: 'toggle', section: 'Captions', default: true },
    ],
  },

  'transcode': {
    type: 'transcode', stage: 'delivery',
    title: 'Transcode', subtitle: 'Codec & container', icon: 'cog',
    execution: 'local',
    inputs: [{ id: 'format', label: 'Format', type: 'format', multi: true }],
    outputs: [{ id: 'file', label: 'File', type: 'video' }],
    params: [
      { id: 'container', label: 'Container', widget: 'select', section: 'Encode', default: 'mp4',
        options: opts(['mp4', 'MP4'], ['webm', 'WebM'], ['mov', 'MOV']) },
      { id: 'videoCodec', label: 'Video codec', widget: 'select', section: 'Encode', default: 'h264',
        options: opts(['h264', 'H.264'], ['h265', 'H.265 / HEVC'], ['vp9', 'VP9'], ['av1', 'AV1'], ['prores', 'ProRes 422']) },
      { id: 'bitrateMode', label: 'Bitrate mode', widget: 'select', section: 'Encode', default: 'crf',
        options: opts(['crf', 'Quality (CRF)'], ['cbr', 'Constant bitrate'], ['vbr', 'Variable bitrate']) },
      { id: 'crf', label: 'CRF quality', widget: 'slider', section: 'Encode', default: 20, min: 12, max: 32, step: 1 },
      { id: 'bitrateMbps', label: 'Bitrate (Mbps)', widget: 'slider', section: 'Encode', default: 12, min: 1, max: 80, step: 1 },
      { id: 'audioCodec', label: 'Audio codec', widget: 'select', section: 'Audio', default: 'aac',
        options: opts(['aac', 'AAC'], ['opus', 'Opus'], ['mp3', 'MP3'], ['pcm', 'PCM (WAV)']) },
      { id: 'audioKbps', label: 'Audio bitrate (kbps)', widget: 'select', section: 'Audio', default: '192',
        options: opts(['128', '128'], ['192', '192'], ['256', '256'], ['320', '320']) },
    ],
  },

  'thumbnail-gen': {
    type: 'thumbnail-gen', stage: 'delivery',
    title: 'Thumbnail', subtitle: 'banana2 cover image', icon: 'gallery-thumbnails',
    execution: 'banana-image',
    inputs: [
      { id: 'keyframe', label: 'Key frame', type: 'image', optional: true },
      { id: 'style', label: 'Style', type: 'style', optional: true },
    ],
    outputs: [{ id: 'thumbnail', label: 'Thumbnail', type: 'image' }],
    promptTemplate: 'High-CTR video thumbnail: {subject}. Headline text: "{headline}" — bold, readable at small size. {composition} composition, {emotion} facial emotion, vivid contrast, {artStyle}. {extra}',
    params: [
      { id: 'subject', label: 'Subject', widget: 'textarea', section: 'Content', promptable: true },
      { id: 'headline', label: 'Headline text', widget: 'text', section: 'Content', promptable: true },
      { id: 'composition', label: 'Composition', widget: 'select', section: 'Content', default: 'rule-thirds', promptable: true,
        options: opts(['rule-thirds', 'Rule of thirds'], ['center-face', 'Centered face'], ['split', 'Before/after split'], ['zoom-detail', 'Zoomed detail']) },
      { id: 'emotion', label: 'Emotion', widget: 'select', section: 'Content', default: 'intrigued', promptable: true,
        options: opts(['intrigued', 'Intrigued'], ['shocked', 'Shocked'], ['joyful', 'Joyful'], ['serious', 'Serious'], ['none', 'No face']) },
      ...styleParams,
      { id: 'aspectRatio', label: 'Aspect ratio', widget: 'aspect', section: 'Generation', options: ASPECT_RATIOS, default: '16:9' },
      seedParam, variantCountParam,
    ],
  },

  'publish': {
    type: 'publish', stage: 'delivery',
    title: 'Publish', subtitle: 'Metadata & scheduling', icon: 'send',
    execution: 'manual',
    inputs: [
      { id: 'file', label: 'Master file', type: 'video' },
      { id: 'thumbnail', label: 'Thumbnail', type: 'image', optional: true },
      { id: 'subtitles', label: 'Subtitles', type: 'subtitle', optional: true },
    ],
    outputs: [],
    params: [
      { id: 'title', label: 'Title', widget: 'text', section: 'Metadata' },
      { id: 'description', label: 'Description', widget: 'textarea', section: 'Metadata' },
      { id: 'tags', label: 'Tags', widget: 'tags', section: 'Metadata' },
      { id: 'visibility', label: 'Visibility', widget: 'select', section: 'Schedule', default: 'private',
        options: opts(['private', 'Private'], ['unlisted', 'Unlisted'], ['public', 'Public'], ['scheduled', 'Scheduled']) },
      { id: 'scheduleAt', label: 'Schedule (ISO)', widget: 'text', section: 'Schedule', placeholder: '2026-07-20T18:00' },
    ],
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function nodesForStage(stage: PipelineStageId): PipelineNodeDef[] {
  return Object.values(PIPELINE_NODE_DEFS).filter((d) => d.stage === stage);
}

export function defaultParams(def: PipelineNodeDef): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of def.params) if (p.default !== undefined) out[p.id] = p.default;
  return out;
}

/** Builds the final prompt for a node from its template + params + upstream text. */
export function buildPrompt(
  def: PipelineNodeDef,
  params: Record<string, unknown>,
  upstreamText: Record<string, string> = {},
): string {
  if (!def.promptTemplate) {
    // Fall back: join every promptable param
    return def.params
      .filter((p) => p.promptable && params[p.id])
      .map((p) => `${p.label}: ${String(params[p.id])}`)
      .join('. ');
  }
  let prompt = def.promptTemplate;
  prompt = prompt.replace(/\{__input_(\w+)\}/g, (_, port) => upstreamText[port] ?? '');
  prompt = prompt.replace(/\{(\w+)\}/g, (_, key) => {
    const v = params[key];
    if (v === undefined || v === null || v === '') return '';
    return Array.isArray(v) ? v.join(', ') : String(v);
  });
  return prompt.replace(/\s{2,}/g, ' ').replace(/\.\s*\./g, '.').trim();
}

/** Port compatibility for edge creation. */
export function portsCompatible(from: string, to: string): boolean {
  if (from === to) return true;
  if (from === 'any' || to === 'any') return true;
  if (from === 'image' && to === 'image-set') return true;
  if (from === 'image-set' && to === 'image') return true;
  if (from === 'script' && to === 'text') return true;
  if (from === 'text' && to === 'script') return true;
  return false;
}
