import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
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
import { saveProjectWorkspaceState } from '@/hooks/useProjectSync';
import { saveToDisk } from '@/hooks/useDiskSave';
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
  description?: string;
  template: string;
  variables: Record<string, string>;
}

/** Compact browse-only list shown inline when templates toggle is open */
const PromptTemplatesSection: React.FC<{
  onUse: (text: string) => void;
  isAuthenticated: boolean;
  onNewTemplate?: () => void;
}> = ({ onUse, isAuthenticated, onNewTemplate }) => {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const updateAsset = useFileStore((s) => s.updateAsset);
  const getAsset = useFileStore((s) => s.getAsset);

  useEffect(() => {
    if (!isAuthenticated) { setTemplates([]); return; }
    setLoading(true);
    fetch('/api/prompts/templates?pageSize=20')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setTemplates(d?.data ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const fillTemplate = (t: PromptTemplate) => {
    let text = t.template;
    for (const [k, v] of Object.entries(t.variables)) {
      text = text.replace(new RegExp(`{{${k}}}`, 'g'), v || `[${k}]`);
    }
    return text;
  };

  if (loading) return (
    <div className={styles.versionLoading}><Loader2 size={12} className={styles.spin} /> Loading…</div>
  );

  return (
    <div className={styles.templateList}>
      <button className={styles.createTemplateBtn} onClick={() => onNewTemplate?.()} type="button">
        <Plus size={12} /> + New template
      </button>
      {templates.length === 0 ? (
        <p className={styles.hint}>No prompt templates found.</p>
      ) : (
        templates.map((t) => (
          <div key={t.id} className={styles.templateCard}>
            <div
              className={styles.templateHeader}
              onClick={() => setExpanded(expanded === t.id ? null : t.id)}
            >
              <span className={styles.templateCategory}>{t.category}</span>
              <span className={styles.templateName}>{t.name}</span>
              <button
                className={styles.useTemplateBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onUse(fillTemplate(t));
                  const assetId = `tmpl-${t.id}`;
                  const asset = getAsset(assetId);
                  if (asset) {
                    updateAsset(assetId, {
                      metadata: {
                        ...asset.metadata,
                        templateUsageCount: (asset.metadata?.templateUsageCount ?? 0) + 1,
                        templateDownloads: (asset.metadata?.templateDownloads ?? 0) + 1,
                      },
                    });
                  }
                }}
                title="Use this template"
              >
                Use
              </button>
            </div>
            {expanded === t.id && (
              <div className={styles.templateBody}>
                {t.description && <p className={styles.templateDescription}>{t.description}</p>}
                <p className={styles.templateText}>{t.template}</p>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

// ─── Template Studio (full-panel template management) ─────────────────────────

/** Cinema expert vocabulary — organized by craft domain */
const VAR_GROUPS: Record<string, string[]> = {
  'Subject & Scene': [
    'subject', 'action', 'environment', 'background', 'props', 'wardrobe',
    'location', 'set_design', 'era', 'extras',
  ],
  'Cinematography': [
    'shot_type', 'angle', 'camera_movement', 'depth_of_field', 'focus_plane',
    'composition', 'headroom', 'lead_room', 'framing',
  ],
  'Camera & Optics': [
    'camera_body', 'lens', 'focal_length', 'aperture', 'iso',
    'shutter_speed', 'format', 'aspect_ratio', 'anamorphic',
  ],
  'Lighting': [
    'light_setup', 'light_quality', 'light_source', 'color_temperature',
    'contrast_ratio', 'shadow_direction', 'fill_ratio', 'practical_light',
  ],
  'Visual Style': [
    'style', 'genre', 'cinematic_movement', 'mood', 'tone',
    'director_reference', 'film_reference', 'period',
  ],
  'Color & Grading': [
    'color_palette', 'color_grade', 'saturation', 'contrast',
    'film_stock', 'lut_reference', 'tint', 'shadows_hue',
  ],
  'Film & Artifacts': [
    'grain', 'noise', 'halation', 'chromatic_aberration',
    'vignette', 'lens_flare', 'bloom', 'motion_blur', 'focus_breathing',
  ],
  'Materials & Surface': [
    'material', 'surface', 'texture', 'finish', 'reflectivity',
    'roughness', 'weathering', 'patina', 'transparency',
  ],
  'Time & Atmosphere': [
    'time_of_day', 'season', 'weather', 'atmosphere',
    'visibility', 'humidity', 'wind', 'precipitation',
  ],
  'Quality & Render': [
    'quality', 'resolution', 'sharpness', 'detail_level',
    'rendering_style', 'fidelity', 'output_format',
  ],
};

/** Tooltips / glossary for each variable — cinema expert definitions */
const VAR_GLOSSARY: Record<string, string> = {
  // Subject & Scene
  subject: 'Main subject(s) in the frame — person, object, creature, or concept.',
  action: 'What the subject is doing — running, standing, reacting.',
  environment: 'Surrounding space — urban rooftop, forest clearing, studio.',
  background: 'What fills the background — bokeh lights, architectural detail.',
  props: 'Objects interacting with the scene — vintage radio, leather suitcase.',
  wardrobe: 'Clothing style, era, fabric — 1940s trench coat, neon puffer.',
  location: 'Physical or conceptual place — Tokyo, Mars, underwater canyon.',
  set_design: 'Production design style — brutalist concrete, art nouveau.',
  era: 'Historical or fictional time period — 1920s Paris, far future.',
  extras: 'Background actors or crowd density — sparse pedestrians, packed market.',
  // Cinematography
  shot_type: 'Frame size — ECU / close-up / MCU / medium / wide / EWS.',
  angle: 'Camera height and perspective — eye-level, high angle, worm\'s eye, Dutch tilt.',
  camera_movement: 'Motion during the shot — static, dolly, Steadicam, handheld, crane, drone.',
  depth_of_field: 'Range of acceptable focus — shallow (bokeh) or deep (everything sharp).',
  focus_plane: 'What is razor-sharp vs out-of-focus — subject, background.',
  composition: 'Rule of thirds, golden ratio, symmetry, negative space, leading lines.',
  headroom: 'Space above the subject\'s head — tight, standard, generous.',
  lead_room: 'Space in the direction of movement or gaze — tight, open.',
  framing: 'How the subject is placed in frame — centered, off-center, obscured.',
  // Camera & Optics
  camera_body: 'Camera model — ARRI Alexa 35, RED V-Raptor, Sony Venice 2, Blackmagic URSA 12K.',
  lens: 'Lens type/model — Cooke S7/i, Zeiss Master Prime, Leica Summilux-C, Panavision C-Series anamorphic.',
  focal_length: 'Lens focal length in mm — 14mm (ultra wide) to 200mm (telephoto).',
  aperture: 'Iris opening — T1.3 wide open (shallow DOF) to T16 (deep DOF).',
  iso: 'Sensor sensitivity — 800 (clean), 3200 (visible grain), 12800 (very noisy).',
  shutter_speed: '180° shutter rule = FPS × 2. 1/50 for 25fps, 1/100 for motion blur reduction.',
  format: 'Capture medium — 35mm film, Super 16, 65mm/IMAX, 4K digital, S35.',
  aspect_ratio: 'Frame dimensions — 2.39:1 Scope, 1.85:1 Flat, 1.78:1 (16:9), 1.33:1 Academy, 1.43:1 IMAX.',
  anamorphic: 'Lens distortion characteristics — horizontal flares, oval bokeh, squeeze factor 1.3× / 2×.',
  // Lighting
  light_setup: 'Rig configuration — 3-point (key/fill/back), Rembrandt, split, butterfly/Paramount, loop.',
  light_quality: 'Hard (sharp shadows, bare HMI) vs soft (diffused, large source, cloudy day).',
  light_source: 'Practical or grip — HMI, tungsten, LED panel, Kino Flo, SkyPanel, candle, neon.',
  color_temperature: 'Warmth of light in Kelvin — 2700K (tungsten) to 6500K (daylight). Mixed for tension.',
  contrast_ratio: 'Key-to-fill ratio — 2:1 (flat) to 16:1 (ultra-dramatic). Classic noir: 8:1 or higher.',
  shadow_direction: 'Motivating light angle — side light, backlight, top light, under-light (horror).',
  fill_ratio: 'Amount of shadow fill — no fill (pure chiaroscuro) to fully lit (high-key).',
  practical_light: 'Light sources visible in frame — desk lamp, TV flicker, neon sign, fire.',
  // Visual Style
  style: 'Aesthetic mode — photorealism, expressionism, impressionism, graphic novel, oil painting.',
  genre: 'Cinematic genre — noir, western, horror, sci-fi, romantic drama, thriller.',
  cinematic_movement: 'Film movement reference — French New Wave, Italian Neorealism, Dogme 95, Cinema Vérité.',
  mood: 'Emotional atmosphere — melancholic, euphoric, tense, serene, ominous, nostalgic.',
  tone: 'Overall register — comedic, tragic, ironic, sincere, satirical.',
  director_reference: 'Style reference — Kubrick (symmetry), Mallick (golden hour), Mann (digital night), WKW (motion blur).',
  film_reference: 'Specific film — Blade Runner 2049, Apocalypse Now, Moonlight, The Godfather.',
  period: 'Art period influence — Art Deco, Bauhaus, Victorian, Surrealism, Futurism.',
  // Color & Grading
  color_palette: 'Dominant hues — teal & orange, desaturated earth tones, monochromatic blue, warm amber.',
  color_grade: 'Grading style — bleach bypass, cross-processed, film emulation, HDR, Ektachrome.',
  saturation: 'Color intensity — desaturated (muted, documentary), natural, super-saturated (vivid).',
  contrast: 'Tonal range — flat (log-like), normal, high contrast (crushed blacks, blown highlights).',
  film_stock: 'Emulsion reference — Kodak Vision3 500T, Fuji Eterna 500, Kodak Ektachrome E100, Agfa.',
  lut_reference: 'Look-Up Table or colour profile — Rec.709, DCI-P3, ACES, custom vendor LUT.',
  tint: 'Global hue shift — green tint (thriller), amber (warmth), cyan (cold sci-fi).',
  shadows_hue: 'Hue of the darkest tones — cool blue shadows, warm brown shadows, green noir shadows.',
  // Film & Artifacts
  grain: 'Film grain amount — fine (100 ISO stock), medium, heavy (pushed 3 stops), digital noise.',
  noise: 'Digital sensor noise pattern — chroma noise, luminance noise, fixed-pattern noise.',
  halation: 'Light bloom around highlights — classic photochemical glow on high-contrast edges.',
  chromatic_aberration: 'Colour fringing on lens edges — subtle vintage, heavy (lo-fi).',
  vignette: 'Edge darkening — subtle optical, heavy oval, anamorphic edge fall-off.',
  lens_flare: 'Anamorphic horizontal flares, circular Zeiss flares, practical sun flare.',
  bloom: 'Highlight glow — anamorphic streak, classic dreamy, diffusion filter (Black Pro-Mist, Glimmer Glass).',
  motion_blur: 'Blur from movement or shutter — gentle 180° rule, stroboscopic look, smear.',
  focus_breathing: 'Focal length shift on focus pull — visible on older prime lenses.',
  // Materials & Surface
  material: 'Primary material — polished steel, weathered concrete, ancient wood, living skin.',
  surface: 'Surface type — smooth, granular, perforated, woven, crystalline.',
  texture: 'Tactile quality — rough, silky, gritty, feathered, embossed.',
  finish: 'Surface finish — matte, satin, gloss, hammered, brushed, anodized.',
  reflectivity: 'Mirror-like to fully absorbing — mirror, semi-specular, diffuse, subsurface scatter.',
  roughness: 'PBR roughness value equivalent — 0 (perfect mirror) to 1 (chalk).',
  weathering: 'Age and wear — pristine, patinated, corroded, sun-bleached, moss-covered.',
  patina: 'Surface oxidation/aging character — verdigris copper, rust bloom, ivory yellowing.',
  transparency: 'Optical clarity — opaque, translucent (frosted glass), transparent (crystal clear).',
  // Time & Atmosphere
  time_of_day: 'Golden hour (sunrise/sunset), blue hour, magic hour, midday (harsh), night.',
  season: 'Spring (fresh green), summer (heat haze), autumn (warm palette), winter (desaturated, cold).',
  weather: 'Clear, overcast, rain, snow, fog/mist, storm, haze, dust storm, Aurora.',
  atmosphere: 'Environmental mood — misty forest, desert heat shimmer, humid jungle.',
  visibility: 'Distance clarity — crisp (mountain air), moderate haze, low visibility fog.',
  humidity: 'Air moisture visible — dry (hard shadows), humid (soft, hazy), wet surfaces reflect.',
  wind: 'Motion of foliage, hair, fabric, dust — still, light breeze, gale.',
  precipitation: 'Rain intensity and direction — drizzle, heavy downpour, sleet, snowfall.',
  // Quality & Render
  quality: 'Output quality descriptors — ultra-detailed, photorealistic, hyperreal, painterly.',
  resolution: '8K, 4K, HD, medium format plate, 70mm scan, LF sensor.',
  sharpness: 'Optical sharpness — tack sharp, moderately sharp, soft focus, diffused.',
  detail_level: 'Level of visible micro-detail — pore-level skin, fabric weave, surface dust.',
  rendering_style: 'If CG — path traced, ray traced, rasterized, hand-drawn look, toon shading.',
  fidelity: 'Realism level — hyperrealistic, stylized realistic, impressionistic, abstract.',
  output_format: 'Final output intent — print, cinema, streaming, social, billboard, mobile.',
};

const STYLE_PRESETS: { label: string; template: string; description: string }[] = [
  {
    label: 'Kubrick Symmetry',
    description: 'Perfect one-point perspective with wide angle distortion',
    template: '{{subject}}, Kubrick one-point perspective, symmetrical composition, wide-angle {{focal_length}}, {{environment}}, {{color_palette}} palette, {{lighting}}, cinematic, ultra-detailed',
  },
  {
    label: 'Terrence Malick',
    description: 'Golden hour magic light with roving handheld camera',
    template: '{{subject}}, golden hour magic light, handheld Steadicam, wide-angle lens, {{environment}}, warm amber colour grade, nature and human interplay, poetic realism, {{mood}}',
  },
  {
    label: 'Michael Mann Night',
    description: 'Digital night photography with wet streets and neon',
    template: '{{subject}} at night, Michael Mann digital aesthetic, wet pavement reflections, neon practical lights, {{color_palette}}, shallow depth of field, Sony Venice 2, cool colour grade, {{environment}}',
  },
  {
    label: 'Denis Villeneuve IMAX',
    description: 'Epic scale wide-format with architectural grandeur',
    template: '{{subject}}, Denis Villeneuve scale, IMAX 1.43:1 format, {{environment}}, desolate grandeur, Hoyte van Hoytema cinematography, desaturated palette with orange accent, Steadicam, {{mood}} atmosphere',
  },
  {
    label: 'Wong Kar-Wai',
    description: 'Dreamy motion blur and saturated neon colors',
    template: '{{subject}}, Wong Kar-Wai aesthetic, step-printing motion blur, 28mm handheld, neon saturated {{color_palette}}, {{time_of_day}}, intimate {{shot_type}}, melancholic nostalgic mood, {{environment}}',
  },
  {
    label: 'Film Noir',
    description: 'High-contrast chiaroscuro with hard shadows',
    template: '{{subject}}, 1940s film noir, hard key light, deep shadows, venetian blind shadow pattern, black and white or desaturated, low angle {{shot_type}}, {{environment}}, cigarette smoke atmosphere, 50mm lens',
  },
  {
    label: 'Spaghetti Western',
    description: 'Extreme close-ups, Leone style, harsh desert light',
    template: '{{subject}}, Leone spaghetti western, {{shot_type}} extreme close-up, harsh midday desert light, squinting eyes, dust and sweat, anamorphic 2.39:1, Ennio morricone visual, {{environment}} landscape',
  },
  {
    label: 'Cinéma Vérité',
    description: 'Raw handheld documentary realism',
    template: '{{subject}}, cinema vérité style, 16mm film stock, heavy grain, handheld camera, natural {{light_source}}, available light only, documentary realism, {{environment}}, {{action}}, candid moment',
  },
  {
    label: 'Product Hero',
    description: 'Commercial studio photography, high-end brand',
    template: '{{subject}} product, studio three-point lighting, {{background}} background, professional {{color_palette}}, macro detail, tack sharp, Hasselblad medium format, {{material}} surface, luxury commercial',
  },
  {
    label: 'Portrait Rembrandt',
    description: 'Classic Rembrandt light with dramatic fall-off',
    template: '{{subject}} portrait, Rembrandt lighting with triangular cheek catchlight, 85mm f/1.4, {{color_temperature}} warm key, dark fill, {{background}}, {{wardrobe}}, {{mood}} expression, skin micro-detail',
  },
  {
    label: 'Sci-Fi Scope',
    description: 'Epic 2.39:1 science fiction with volumetric lighting',
    template: '{{subject}}, science fiction, 2.39:1 anamorphic, volumetric light shafts, {{environment}}, teal and orange colour grade, lens flare, {{camera_body}}, practical LED panels, {{era}} aesthetic, epic scale',
  },
  {
    label: 'Golden Landscape',
    description: 'Sweeping natural panorama at golden hour',
    template: '{{environment}} landscape, {{time_of_day}} golden light, {{season}}, {{weather}}, sweeping wide shot, {{camera_movement}}, natural colours, {{atmosphere}}, {{style}}, atmospheric depth',
  },
];

// ─── Scene Brief data model ───────────────────────────────────────────────────
interface SceneBrief {
  name: string; category: string; description: string;
  // WHO / WHAT
  subject: string; subjectVar: boolean;
  action: string; actionVar: boolean;
  emotion: string; narrativePurpose: string;
  // WHERE / WHEN
  locationType: string; locationSubtype: string;
  locationDetail: string; locationVar: boolean;
  timeOfDay: string; season: string; weather: string; era: string;
  // HOW — Camera
  cameraBody: string; lensType: string;
  shotType: string; shotTypeVar: boolean;
  cameraAngle: string; cameraMovement: string; aspectRatio: string;
  // HOW — Look
  lightSetup: string; lightQuality: string;
  colorTemperature: string; contrastRatio: string;
  colorPalette: string; filmStock: string;
  directorRef: string; filmRef: string; platform: string;
  // Manual override
  templateOverride: string; isGlobal: boolean;
}

const DEFAULT_BRIEF: SceneBrief = {
  name: '', category: 'general', description: '',
  subject: '', subjectVar: true, action: '', actionVar: false,
  emotion: '', narrativePurpose: '',
  locationType: '', locationSubtype: '', locationDetail: '', locationVar: false,
  timeOfDay: '', season: '', weather: '', era: '',
  cameraBody: '', lensType: '', shotType: '', shotTypeVar: true,
  cameraAngle: '', cameraMovement: '', aspectRatio: '',
  lightSetup: '', lightQuality: '', colorTemperature: '',
  contrastRatio: '', colorPalette: '', filmStock: '',
  directorRef: '', filmRef: '', platform: '',
  templateOverride: '', isGlobal: false,
};

const BRIEF_STEPS = ['who', 'where', 'camera', 'look'] as const;
type BriefStepId = typeof BRIEF_STEPS[number];
const BRIEF_STEP_LABELS: Record<BriefStepId, string> = {
  who: 'Who & What', where: 'Space & Time', camera: 'Camera', look: 'Look & Feel',
};

/** All enumerated choices — cinema expert vocabulary */
const SC = {
  emotions: ['calm', 'tense', 'euphoric', 'melancholic', 'ominous', 'playful', 'romantic', 'gritty', 'anxious', 'serene', 'hopeful', 'desperate'],
  narrativePurposes: ['inciting incident', 'rising tension', 'climax', 'character reveal', 'transition', 'resolution', 'flashback', 'dream sequence'],
  interiorSubs: ['home', 'studio', 'office', 'bar / club', 'hospital', 'warehouse', 'hotel room', 'church', 'prison cell', 'vehicle', 'corridor'],
  exteriorSubs: ['urban street', 'forest', 'desert', 'mountain', 'coastal', 'rural', 'industrial', 'wasteland'],
  timesOfDay: [
    { v: 'pre-dawn blue ambient', l: 'Pre-dawn' }, { v: 'sunrise warm directional', l: 'Sunrise' },
    { v: 'golden hour raking warm light', l: 'Golden hour' }, { v: 'soft overcast diffused daylight', l: 'Overcast' },
    { v: 'harsh midday sunlight', l: 'Midday' }, { v: 'dusk transitional light', l: 'Dusk' },
    { v: 'blue hour cinematic ambient', l: 'Blue hour' }, { v: 'magic hour fleeting warm glow', l: 'Magic hour' },
    { v: 'night artificial practical lights', l: 'Night' }, { v: 'deep night near darkness', l: 'Deep night' },
  ],
  seasons: [
    { v: 'spring fresh greens', l: 'Spring' }, { v: 'summer heat vivid colours', l: 'Summer' },
    { v: 'autumn warm palette fallen leaves', l: 'Autumn' }, { v: 'winter cold desaturated snow', l: 'Winter' },
  ],
  weathers: ['clear sky', 'overcast', 'light rain', 'heavy downpour', 'snow', 'thick fog', 'dust storm', 'storm', 'heat haze'],
  eras: ['ancient', 'medieval', 'renaissance', '1800s industrial', '1920s', '1940s', '1960s', '1980s', 'contemporary', 'near future', 'far future'],
  cameraBodies: ['ARRI Alexa 35', 'ARRI Mini LF', 'RED V-Raptor', 'Sony Venice 2', 'Blackmagic URSA 12K', '35mm film', 'Super 16mm', '65mm IMAX', 'mirrorless digital'],
  lensTypes: ['spherical prime', 'spherical zoom', 'anamorphic 1.3×', 'anamorphic 2×', 'vintage spherical', 'vintage anamorphic', 'ultra-wide'],
  shotTypes: [
    { v: 'extreme close-up (ECU)', l: 'ECU' }, { v: 'close-up (CU)', l: 'CU' },
    { v: 'medium close-up (MCU)', l: 'MCU' }, { v: 'medium shot (MS)', l: 'MS' },
    { v: 'medium wide (MWS)', l: 'MWS' }, { v: 'wide shot (WS)', l: 'WS' },
    { v: 'extreme wide (EWS)', l: 'EWS' }, { v: 'over-the-shoulder (OTS)', l: 'OTS' },
    { v: 'two-shot', l: '2-shot' }, { v: 'point of view (POV)', l: 'POV' }, { v: 'insert shot', l: 'Insert' },
  ],
  angles: ['eye-level', 'low angle', 'high angle', 'Dutch tilt', "bird's eye", "worm's eye"],
  movements: ['static', 'handheld', 'Steadicam', 'dolly / track', 'crane / jib', 'drone / aerial', 'whip pan', 'push in / pull out', 'arc / orbit'],
  aspectRatios: ['1.33:1 (Academy)', '1.78:1 (16:9)', '1.85:1 (Flat)', '2.35:1', '2.39:1 (Scope)', '2.76:1 (Ultra-Pana)', '1.43:1 (IMAX)', '9:16 (Social)'],
  lightSetups: ['available light', '3-point', 'Rembrandt', 'split', 'butterfly', 'silhouette', 'chiaroscuro', 'high-key', 'low-key'],
  lightQualities: ['hard (direct)', 'medium-soft (bounced)', 'soft (large diffused)', 'very soft (overcast)'],
  colorTemps: ['warm 2700K', 'warm 3200K', 'neutral 4000K', 'daylight 5600K', 'cool 7000K', 'mixed warm/cool'],
  contrastRatios: ['flat 2:1', 'normal 4:1', 'dramatic 8:1', 'noir 16:1+'],
  colorPalettes: ['teal & orange', 'warm amber', 'desaturated earth', 'monochromatic blue', 'pastel muted', 'high-contrast B&W', 'neon saturated', 'verdant green', 'golden sepia'],
  filmStocks: ['Kodak Vision3 500T', 'Kodak Vision3 200T', 'Fuji Eterna 500', 'Ektachrome E100', 'Tri-X 400 (B&W)', 'digital clean', 'digital pushed grain'],
  directorRefs: ['Kubrick', 'Malick', 'Michael Mann', 'Villeneuve', 'Wong Kar-Wai', 'Fincher', 'Nolan', 'Cuarón', 'Sorrentino', 'Park Chan-wook', 'Ridley Scott', 'Coen Brothers', 'Leone', 'Godard', 'Tarkovsky'],
  platforms: ['cinema (DCI)', 'streaming (Netflix)', 'HBO / prestige TV', 'social (9:16)', 'commercial', 'documentary', 'music video'],
};

/** Assembles the prompt from structured brief choices */
const assemblePrompt = (b: SceneBrief): string => {
  const p: string[] = [];
  // WHO / WHAT
  if (b.subjectVar) p.push('{{subject}}');
  else if (b.subject) p.push(b.subject);
  if (b.actionVar) p.push('{{action}}');
  else if (b.action) p.push(b.action);
  if (b.emotion) p.push(`${b.emotion} mood`);
  if (b.narrativePurpose) p.push(b.narrativePurpose);
  // WHERE / WHEN
  if (b.locationVar) p.push('{{environment}}');
  else {
    const loc = [b.locationType, b.locationDetail || b.locationSubtype].filter(Boolean).join(' ');
    if (loc) p.push(loc);
  }
  if (b.timeOfDay) p.push(b.timeOfDay);
  if (b.era && !b.era.includes('contemporary')) p.push(`${b.era} era`);
  if (b.season) p.push(b.season);
  if (b.weather && b.weather !== 'clear sky') p.push(b.weather);
  // CAMERA
  const shot = b.shotTypeVar ? '{{shot_type}}' : b.shotType;
  if (shot) p.push(shot);
  if (b.cameraAngle && b.cameraAngle !== 'eye-level') p.push(b.cameraAngle);
  if (b.cameraMovement && b.cameraMovement !== 'static') p.push(`${b.cameraMovement} camera`);
  if (b.cameraBody) p.push(`shot on ${b.cameraBody}`);
  if (b.lensType) p.push(`${b.lensType} lens`);
  if (b.aspectRatio) p.push(b.aspectRatio);
  // LOOK
  if (b.lightSetup && b.lightSetup !== 'available light') p.push(`${b.lightSetup} lighting`);
  if (b.lightQuality) p.push(`${b.lightQuality} light`);
  if (b.colorTemperature) p.push(b.colorTemperature);
  if (b.contrastRatio) p.push(`${b.contrastRatio} contrast`);
  if (b.colorPalette) p.push(`${b.colorPalette} colour palette`);
  if (b.filmStock && !b.filmStock.includes('digital clean')) p.push(b.filmStock);
  if (b.directorRef) p.push(`${b.directorRef} style`);
  if (b.filmRef) p.push(`inspired by ${b.filmRef}`);
  if (b.platform) p.push(`for ${b.platform}`);
  return p.filter(Boolean).join(', ');
};

const TemplateStudio: React.FC<{
  initialView: 'list' | 'create';
  isAuthenticated: boolean;
  onUse: (text: string) => void;
  onClose: () => void;
}> = ({ initialView, isAuthenticated, onUse, onClose }) => {
  const [view, setView] = useState<'list' | 'create'>(initialView);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [brief, setBrief] = useState<SceneBrief>(DEFAULT_BRIEF);
  const [briefStep, setBriefStep] = useState<BriefStepId>('who');
  const [showTemplateEdit, setShowTemplateEdit] = useState(false);

  const addAssetToFolder = useFileStore((s) => s.addAssetToFolder);
  const updateAsset = useFileStore((s) => s.updateAsset);
  const getAsset = useFileStore((s) => s.getAsset);
  const addItem = useCanvasStore((s) => s.addItem);
  const toast = useToastStore();

  useEffect(() => {
    if (!isAuthenticated) { setTemplates([]); return; }
    setLoading(true);
    fetch('/api/prompts/templates?pageSize=50')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setTemplates(d?.data ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const assembledText = useMemo(() => {
    if (brief.templateOverride.trim()) return brief.templateOverride;
    return assemblePrompt(brief);
  }, [brief]);

  const detectedVars = useMemo(() => {
    const hits = assembledText.match(/\{\{([^}]+)\}\}/g) ?? [];
    return [...new Set(hits.map((m) => m.slice(2, -2)))];
  }, [assembledText]);

  const currentStepIndex = BRIEF_STEPS.indexOf(briefStep);

  const setB = useCallback(<K extends keyof SceneBrief>(key: K, value: SceneBrief[K]) => {
    setBrief((b) => ({ ...b, [key]: value }));
  }, []);

  const chip = useCallback((key: keyof SceneBrief, value: string) => {
    setBrief((b) => ({ ...b, [key]: (b[key] as string) === value ? '' : value }));
  }, []);

  const handleSave = async () => {
    if (!isAuthenticated) {
      toast.error('Sign in required', 'Saving templates needs an active session.');
      return;
    }
    const name = brief.name.trim();
    const templateText = assembledText.trim();
    if (!name || !templateText) {
      toast.warning('Incomplete template', 'Add a name and prompt text before saving.');
      return;
    }
    setSaving(true);
    try {
      const variables = Object.fromEntries(detectedVars.map((v) => [v, ''])) as Record<string, string>;

      let templateId = '';
      let created: PromptTemplate | null = null;
      let dbOk = false;

      const res = await fetch('/api/prompts/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category: brief.category || 'general',
          description: brief.description.trim() || undefined,
          template: templateText,
          variables,
          isGlobal: brief.isGlobal,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const row: PromptTemplate = json?.data ?? json;
        if (row?.id) {
          created = row;
          templateId = row.id;
          dbOk = true;
        } else {
          templateId = `local-${uuidv4()}`;
          toast.warning(
            'Library sync issue',
            'Server returned no template id. The JSON file will still be saved.',
            6000
          );
        }
      } else {
        const errJson = await res.json().catch(() => null);
        const msg = errJson?.error?.message || res.statusText || `HTTP ${res.status}`;
        console.warn('[TemplateStudio] Database save failed:', msg);
        templateId = `local-${uuidv4()}`;
        toast.warning(
          'Library sync unavailable',
          'Template will still be saved as a JSON file on disk. Database: ' + msg,
          7000
        );
      }

      if (!templateId) templateId = `local-${uuidv4()}`;

      const slugFromName = (n: string) =>
        n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'template';
      let slug = slugFromName(created?.name || name);
      if (!dbOk) {
        slug = `${slug}-${templateId.replace(/\W/g, '').slice(-8)}`;
      }

      const fileRes = await fetch('/api/prompts/save-template-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: templateId,
          name: created?.name || name,
          slug,
          category: brief.category || 'general',
          description: brief.description.trim() || undefined,
          template: templateText,
          variables,
          sceneBrief: { ...brief },
          isGlobal: brief.isGlobal,
        }),
      });

      if (!fileRes.ok) {
        const errJson = await fileRes.json().catch(() => null);
        const msg = errJson?.error?.message || fileRes.statusText || 'Could not write template file';
        toast.error('Save failed', msg);
        return;
      }

      const filePayload = await fileRes.json();
      const savedFileName: string = filePayload?.data?.fileName ?? `${slug}.template.json`;

      const listEntry: PromptTemplate =
        created ?? {
          id: templateId,
          name,
          category: brief.category || 'general',
          description: brief.description.trim() || undefined,
          template: templateText,
          variables,
        };

      setTemplates((prev) => {
        const without = prev.filter((t) => t.id !== listEntry.id);
        return [listEntry, ...without];
      });

      const assetId = `tmpl-${templateId}`;
      addAssetToFolder(
        {
          id: assetId,
          name: savedFileName,
          type: 'prompt',
          path: `/prompts/${savedFileName}`,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          metadata: {
            prompt: templateText,
            mimeType: 'application/json',
            source: 'generated',
            usageCount: 0,
            projectIds: [],
            variationIds: [],
            childAssetIds: [],
            templateId,
            templateCategory: listEntry.category || 'general',
            templateUsageCount: 0,
            templateDownloads: 0,
          },
        },
        '/prompts'
      );

      addItem({
        type: 'template',
        x: 60 + Math.random() * 220,
        y: 60 + Math.random() * 220,
        width: 280,
        height: 170,
        rotation: 0,
        scale: 1,
        locked: false,
        visible: true,
        name: listEntry.name,
        prompt: listEntry.template,
        assetId,
      });

      await saveToDisk().catch(() => {});

      toast.success(
        'Template saved',
        dbOk
          ? `${savedFileName} — on disk under .ars-data/prompts and in your library.`
          : `${savedFileName} saved under .ars-data/prompts. Connect the database to sync the template list.`,
        6500
      );

      setBrief(DEFAULT_BRIEF);
      setBriefStep('who');
      setShowTemplateEdit(false);
      setExpandedId(listEntry.id);
      setView('list');
    } finally {
      setSaving(false);
    }
  };

  const handleUse = (t: PromptTemplate) => {
    let text = t.template;
    for (const [k, v] of Object.entries(t.variables)) {
      text = text.replace(new RegExp(`{{${k}}}`, 'g'), v || `[${k}]`);
    }
    const assetId = `tmpl-${t.id}`;
    const asset = getAsset(assetId);
    if (asset) {
      updateAsset(assetId, {
        metadata: {
          ...asset.metadata,
          templateUsageCount: (asset.metadata?.templateUsageCount ?? 0) + 1,
          templateDownloads: (asset.metadata?.templateDownloads ?? 0) + 1,
        },
      });
    }
    onUse(text);
  };

  return (
    <div className={styles.templateStudio}>
      {/* ── Header ── */}
      <div className={styles.templateStudioHeader}>
        <button className={styles.templateStudioBack} onClick={onClose}>
          <ChevronLeft size={13} /> Prompt
        </button>
        <div className={styles.templateStudioTabs}>
          <button
            className={`${styles.templateStudioTab} ${view === 'list' ? styles.templateStudioTabActive : ''}`}
            onClick={() => setView('list')}
          >
            Browse{templates.length > 0 && <span className={styles.templateStudioTabBadge}>{templates.length}</span>}
          </button>
          <button
            className={`${styles.templateStudioTab} ${view === 'create' ? styles.templateStudioTabActive : ''}`}
            onClick={() => { setView('create'); setBriefStep('who'); }}
          >
            <Plus size={10} /> New
          </button>
        </div>
      </div>

      {/* ── Browse ── */}
      {view === 'list' && (
        <div className={styles.templateStudioScroll}>
          {loading ? (
            <div className={styles.versionLoading}><Loader2 size={12} className={styles.spin} /> Loading…</div>
          ) : templates.length === 0 ? (
            <div className={styles.templateStudioEmpty}>
              <BookOpen size={22} /><p>No templates yet.</p>
              <button className={styles.templateStudioEmptyBtn} onClick={() => setView('create')}>
                <Plus size={11} /> Create first template
              </button>
            </div>
          ) : templates.map((t) => (
            <div key={t.id} className={styles.templateStudioCard}>
              <div className={styles.templateStudioCardHeader} onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}>
                <div className={styles.templateStudioCardMeta}>
                  <span className={styles.templateCategory}>{t.category}</span>
                  <span className={styles.templateStudioCardName}>{t.name}</span>
                </div>
                <button className={styles.templateStudioUseBtn} onClick={(e) => { e.stopPropagation(); handleUse(t); onClose(); }}>
                  Use
                </button>
              </div>
              {expandedId === t.id && (
                <div className={styles.templateBody}>
                  {t.description && <p className={styles.templateDescription}>{t.description}</p>}
                  <p className={styles.templateText}>{t.template}</p>
                  {Object.keys(t.variables).length > 0 && (
                    <div className={styles.varDetectedList}>
                      {Object.keys(t.variables).map((v) => <span key={v} className={styles.varDetectedPill}>{`{{${v}}}`}</span>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Scene Brief Wizard ── */}
      {view === 'create' && (
        <>
          {/* Always-visible identity */}
          <div className={styles.briefMeta}>
            <Input
              label="Scene template name *"
              value={brief.name}
              onChange={(e) => setB('name', e.target.value)}
              placeholder="e.g. Night Alley — Tokyo, SC-003"
            />
            <div className={styles.studioFieldRow}>
              <Input label="Category" value={brief.category} onChange={(e) => setB('category', e.target.value)} placeholder="general" />
              <Input label="Scene code" value={brief.description} onChange={(e) => setB('description', e.target.value)} placeholder="SC-003" />
            </div>
          </div>

          {/* Step progress */}
          <div className={styles.briefProgress}>
            {BRIEF_STEPS.map((step, i) => (
              <button
                key={step}
                className={`${styles.briefProgressStep} ${briefStep === step ? styles.briefProgressStepActive : ''} ${i < currentStepIndex ? styles.briefProgressStepDone : ''}`}
                onClick={() => setBriefStep(step)}
              >
                <span className={styles.briefProgressNum}>{i + 1}</span>
                <span className={styles.briefProgressLabel}>{BRIEF_STEP_LABELS[step]}</span>
              </button>
            ))}
          </div>

          {/* Step content (scrollable) */}
          <div className={styles.templateStudioScroll} style={{ flex: 1 }}>

            {/* ─ WHO & WHAT ─ */}
            {briefStep === 'who' && (
              <div className={styles.briefStepContent}>
                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>Quick-start presets<span className={styles.studioSectionHint}>populates template body</span></div>
                  <div className={styles.presetScroll}>
                    {STYLE_PRESETS.map((p) => (
                      <button key={p.label} className={styles.presetChip} title={p.description}
                        onClick={() => setBrief((b) => ({ ...b, templateOverride: p.template, name: b.name || p.label }))}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>WHO — Subject<span className={styles.studioSectionHint}>{`{{var}}`} = varies per shot</span></div>
                  <div className={styles.briefVarRow}>
                    <Input label="" value={brief.subject} onChange={(e) => setB('subject', e.target.value)} placeholder="e.g. detective in worn suit, young woman" />
                    <button className={`${styles.briefVarToggle} ${brief.subjectVar ? styles.briefVarToggleOn : ''}`} onClick={() => setB('subjectVar', !brief.subjectVar)} title={brief.subjectVar ? 'Using {{subject}} — varies per shot' : 'Fixed for all shots'}>
                      {`{{v}}`}
                    </button>
                  </div>
                </div>

                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>WHAT — Action<span className={styles.studioSectionHint}>varies per shot?</span></div>
                  <div className={styles.briefVarRow}>
                    <Input label="" value={brief.action} onChange={(e) => setB('action', e.target.value)} placeholder="e.g. walking, confronting, gazing" />
                    <button className={`${styles.briefVarToggle} ${brief.actionVar ? styles.briefVarToggleOn : ''}`} onClick={() => setB('actionVar', !brief.actionVar)}>
                      {`{{v}}`}
                    </button>
                  </div>
                </div>

                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>WHY — Emotional tone</div>
                  <div className={styles.briefChipGrid}>
                    {SC.emotions.map((e) => <button key={e} className={`${styles.briefChip} ${brief.emotion === e ? styles.briefChipActive : ''}`} onClick={() => chip('emotion', e)}>{e}</button>)}
                  </div>
                </div>

                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>WHY — Narrative beat</div>
                  <div className={styles.briefChipGrid}>
                    {SC.narrativePurposes.map((n) => <button key={n} className={`${styles.briefChip} ${brief.narrativePurpose === n ? styles.briefChipActive : ''}`} onClick={() => chip('narrativePurpose', n)}>{n}</button>)}
                  </div>
                </div>
              </div>
            )}

            {/* ─ SPACE & TIME ─ */}
            {briefStep === 'where' && (
              <div className={styles.briefStepContent}>
                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>WHERE — Interior or exterior</div>
                  <div className={styles.briefChipGrid}>
                    {(['interior', 'exterior', 'composite'] as const).map((t) => (
                      <button key={t} className={`${styles.briefChip} ${brief.locationType === t ? styles.briefChipActive : ''}`}
                        onClick={() => { chip('locationType', t); setB('locationSubtype', ''); }}>{t}</button>
                    ))}
                  </div>
                </div>

                {brief.locationType === 'interior' && (
                  <div className={styles.studioSection}>
                    <div className={styles.studioSectionLabel}>Interior type</div>
                    <div className={styles.briefChipGrid}>
                      {SC.interiorSubs.map((s) => <button key={s} className={`${styles.briefChip} ${brief.locationSubtype === s ? styles.briefChipActive : ''}`} onClick={() => chip('locationSubtype', s)}>{s}</button>)}
                    </div>
                  </div>
                )}
                {brief.locationType === 'exterior' && (
                  <div className={styles.studioSection}>
                    <div className={styles.studioSectionLabel}>Exterior type</div>
                    <div className={styles.briefChipGrid}>
                      {SC.exteriorSubs.map((s) => <button key={s} className={`${styles.briefChip} ${brief.locationSubtype === s ? styles.briefChipActive : ''}`} onClick={() => chip('locationSubtype', s)}>{s}</button>)}
                    </div>
                  </div>
                )}

                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>Location detail<span className={styles.studioSectionHint}>fixed for whole scene</span></div>
                  <div className={styles.briefVarRow}>
                    <Input label="" value={brief.locationDetail} onChange={(e) => setB('locationDetail', e.target.value)} placeholder="e.g. rain-soaked Tokyo back alley, neon signs" />
                    <button className={`${styles.briefVarToggle} ${brief.locationVar ? styles.briefVarToggleOn : ''}`} onClick={() => setB('locationVar', !brief.locationVar)} title={brief.locationVar ? 'Using {{environment}}' : 'Fixed for scene'}>
                      {`{{v}}`}
                    </button>
                  </div>
                </div>

                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>WHEN — Time of day</div>
                  <div className={styles.briefChipGrid}>
                    {SC.timesOfDay.map(({ v, l }) => <button key={v} className={`${styles.briefChip} ${brief.timeOfDay === v ? styles.briefChipActive : ''}`} onClick={() => chip('timeOfDay', v)}>{l}</button>)}
                  </div>
                </div>

                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>WHEN — Season</div>
                  <div className={styles.briefChipGrid}>
                    {SC.seasons.map(({ v, l }) => <button key={v} className={`${styles.briefChip} ${brief.season === v ? styles.briefChipActive : ''}`} onClick={() => chip('season', v)}>{l}</button>)}
                  </div>
                </div>

                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>WHEN — Weather & atmosphere</div>
                  <div className={styles.briefChipGrid}>
                    {SC.weathers.map((w) => <button key={w} className={`${styles.briefChip} ${brief.weather === w ? styles.briefChipActive : ''}`} onClick={() => chip('weather', w)}>{w}</button>)}
                  </div>
                </div>

                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>WHEN — Era / period</div>
                  <div className={styles.briefChipGrid}>
                    {SC.eras.map((e) => <button key={e} className={`${styles.briefChip} ${brief.era === e ? styles.briefChipActive : ''}`} onClick={() => chip('era', e)}>{e}</button>)}
                  </div>
                </div>
              </div>
            )}

            {/* ─ CAMERA ─ */}
            {briefStep === 'camera' && (
              <div className={styles.briefStepContent}>
                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>HOW — Shot size<span className={styles.studioSectionHint}>usually varies per shot</span></div>
                  <div className={styles.briefVarToggleRow}>
                    <div className={styles.briefChipGrid}>
                      {SC.shotTypes.map(({ v, l }) => (
                        <button key={v}
                          className={`${styles.briefChip} ${brief.shotType === v ? styles.briefChipActive : ''} ${brief.shotTypeVar ? styles.briefChipDim : ''}`}
                          onClick={() => { if (!brief.shotTypeVar) chip('shotType', v); }}>{l}</button>
                      ))}
                    </div>
                    <button className={`${styles.briefVarToggle} ${brief.shotTypeVar ? styles.briefVarToggleOn : ''}`} style={{ alignSelf: 'flex-start' }} onClick={() => setB('shotTypeVar', !brief.shotTypeVar)}>
                      {`{{v}}`}
                    </button>
                  </div>
                </div>

                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>HOW — Camera angle</div>
                  <div className={styles.briefChipGrid}>
                    {SC.angles.map((a) => <button key={a} className={`${styles.briefChip} ${brief.cameraAngle === a ? styles.briefChipActive : ''}`} onClick={() => chip('cameraAngle', a)}>{a}</button>)}
                  </div>
                </div>

                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>HOW — Camera movement</div>
                  <div className={styles.briefChipGrid}>
                    {SC.movements.map((m) => <button key={m} className={`${styles.briefChip} ${brief.cameraMovement === m ? styles.briefChipActive : ''}`} onClick={() => chip('cameraMovement', m)}>{m}</button>)}
                  </div>
                </div>

                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>BY — Camera body</div>
                  <div className={styles.briefChipGrid}>
                    {SC.cameraBodies.map((c) => <button key={c} className={`${styles.briefChip} ${brief.cameraBody === c ? styles.briefChipActive : ''}`} onClick={() => chip('cameraBody', c)}>{c}</button>)}
                  </div>
                </div>

                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>BY — Lens type</div>
                  <div className={styles.briefChipGrid}>
                    {SC.lensTypes.map((l) => <button key={l} className={`${styles.briefChip} ${brief.lensType === l ? styles.briefChipActive : ''}`} onClick={() => chip('lensType', l)}>{l}</button>)}
                  </div>
                </div>

                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>FOR — Aspect ratio</div>
                  <div className={styles.briefChipGrid}>
                    {SC.aspectRatios.map((r) => <button key={r} className={`${styles.briefChip} ${brief.aspectRatio === r ? styles.briefChipActive : ''}`} onClick={() => chip('aspectRatio', r)}>{r}</button>)}
                  </div>
                </div>
              </div>
            )}

            {/* ─ LOOK & FEEL ─ */}
            {briefStep === 'look' && (
              <div className={styles.briefStepContent}>
                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>HOW — Light quality</div>
                  <div className={styles.briefChipGrid}>
                    {SC.lightQualities.map((q) => <button key={q} className={`${styles.briefChip} ${brief.lightQuality === q ? styles.briefChipActive : ''}`} onClick={() => chip('lightQuality', q)}>{q}</button>)}
                  </div>
                </div>
                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>HOW — Lighting setup</div>
                  <div className={styles.briefChipGrid}>
                    {SC.lightSetups.map((s) => <button key={s} className={`${styles.briefChip} ${brief.lightSetup === s ? styles.briefChipActive : ''}`} onClick={() => chip('lightSetup', s)}>{s}</button>)}
                  </div>
                </div>
                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>HOW — Colour temperature</div>
                  <div className={styles.briefChipGrid}>
                    {SC.colorTemps.map((t) => <button key={t} className={`${styles.briefChip} ${brief.colorTemperature === t ? styles.briefChipActive : ''}`} onClick={() => chip('colorTemperature', t)}>{t}</button>)}
                  </div>
                </div>
                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>HOW — Contrast ratio</div>
                  <div className={styles.briefChipGrid}>
                    {SC.contrastRatios.map((c) => <button key={c} className={`${styles.briefChip} ${brief.contrastRatio === c ? styles.briefChipActive : ''}`} onClick={() => chip('contrastRatio', c)}>{c}</button>)}
                  </div>
                </div>
                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>HOW — Colour palette</div>
                  <div className={styles.briefChipGrid}>
                    {SC.colorPalettes.map((p) => <button key={p} className={`${styles.briefChip} ${brief.colorPalette === p ? styles.briefChipActive : ''}`} onClick={() => chip('colorPalette', p)}>{p}</button>)}
                  </div>
                </div>
                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>HOW — Film stock / emulation</div>
                  <div className={styles.briefChipGrid}>
                    {SC.filmStocks.map((f) => <button key={f} className={`${styles.briefChip} ${brief.filmStock === f ? styles.briefChipActive : ''}`} onClick={() => chip('filmStock', f)}>{f}</button>)}
                  </div>
                </div>
                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>BY — Director / DOP reference</div>
                  <div className={styles.briefChipGrid}>
                    {SC.directorRefs.map((d) => <button key={d} className={`${styles.briefChip} ${brief.directorRef === d ? styles.briefChipActive : ''}`} onClick={() => chip('directorRef', d)}>{d}</button>)}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <Input label="" value={brief.filmRef} onChange={(e) => setB('filmRef', e.target.value)} placeholder="Film reference e.g. Blade Runner 2049" />
                  </div>
                </div>
                <div className={styles.studioSection}>
                  <div className={styles.studioSectionLabel}>FOR — Output platform</div>
                  <div className={styles.briefChipGrid}>
                    {SC.platforms.map((p) => <button key={p} className={`${styles.briefChip} ${brief.platform === p ? styles.briefChipActive : ''}`} onClick={() => chip('platform', p)}>{p}</button>)}
                  </div>
                </div>
              </div>
            )}

            {/* ── Live assembled template ── */}
            <div className={styles.studioSection} style={{ marginTop: 4, borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
              <div className={styles.studioSectionLabel}>
                Assembled template
                <button className={styles.studioEditInlineBtn}
                  onClick={() => {
                    if (!showTemplateEdit && !brief.templateOverride) setB('templateOverride', assembledText);
                    setShowTemplateEdit((v) => !v);
                  }}>
                  {showTemplateEdit ? '← Auto' : 'Edit'}
                </button>
              </div>
              {showTemplateEdit ? (
                <Textarea value={brief.templateOverride} onChange={(e) => setB('templateOverride', e.target.value)} rows={4} placeholder="Edit the assembled template…" />
              ) : (
                <div className={styles.studioPreview}>
                  {assembledText || <span style={{ color: 'var(--text-muted)', opacity: 0.55, fontStyle: 'italic' }}>Make selections above…</span>}
                </div>
              )}
              {detectedVars.length > 0 && (
                <div className={styles.varDetectedList} style={{ marginTop: 6 }}>
                  {detectedVars.map((v) => <span key={v} className={styles.varDetectedPill}>{`{{${v}}}`}</span>)}
                </div>
              )}
            </div>
          </div>

          {/* Step navigation */}
          <div className={styles.briefNav}>
            {currentStepIndex > 0 ? (
              <button className={styles.briefNavPrev} onClick={() => setBriefStep(BRIEF_STEPS[currentStepIndex - 1])}>
                <ChevronLeft size={11} /> {BRIEF_STEP_LABELS[BRIEF_STEPS[currentStepIndex - 1]]}
              </button>
            ) : <span />}
            {currentStepIndex < BRIEF_STEPS.length - 1 ? (
              <button className={styles.briefNavNext} onClick={() => setBriefStep(BRIEF_STEPS[currentStepIndex + 1])}>
                {BRIEF_STEP_LABELS[BRIEF_STEPS[currentStepIndex + 1]]} <ChevronRight size={11} />
              </button>
            ) : (
              <button className={styles.studioSaveBtn} disabled={!brief.name.trim() || !assembledText.trim() || saving} onClick={handleSave}>
                {saving ? <><Loader2 size={11} className={styles.spin} /> Saving…</> : 'Save Template'}
              </button>
            )}
          </div>
        </>
      )}
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
  const { updateAsset, addAssetToFolder, getProjectGeneratedPath, getAsset } = useFileStore();
  const settings = useSettingsStore((s) => s.settings);
  const updateAIProvider = useSettingsStore((s) => s.updateAIProvider);
  const log = useLogStore((s) => s.log);
  const selectedItems = useCanvasStore((s) => s.getSelectedItems());
  const selectedItem = selectedItems[0];
  const { projectId, projectName, markDirty } = useProjectStore();

  const [localApiKey, setLocalApiKey] = useState(settings.aiProvider?.apiKey || '');
  const [showTemplates, setShowTemplates] = useState(false);
  /** 'prompt' = normal prompt UI, 'templates' = TemplateStudio panel */
  const [promptMode, setPromptMode] = useState<'prompt' | 'templates'>('prompt');
  const [templateInitialView, setTemplateInitialView] = useState<'list' | 'create'>('list');
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

      const variationSizes = [{ width: genWidth, height: genHeight, label: `${genWidth}x${genHeight}` }];
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
        variations: variationSizes.map((v, idx) => ({
          id: `size-${idx + 1}`,
          label: v.label,
          filePath: result.filePath || `/generated/${filename}`,
        })),
      };

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
            source: 'generated',
            projectIds: projectId ? [projectId] : [],
            variationIds: generationMeta.variations?.map((v) => v.id) || [],
            childAssetIds: [],
            usageCount: 0,
          },
        },
        generatedFolderPath,
      );

      // Persist generation metadata to JSON (upsert)
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
          parentIds: generationMeta.parentIds || [],
          childIds: generationMeta.childIds || [],
          imageVersion: generationMeta.imageVersion || 1,
          imageVersionLabel: `v${generationMeta.imageVersion || 1}`,
          variations: generationMeta.variations || [],
          variationSizes,
          canvasItemId: canvasItem.id,
          position: { x: canvasItem.x, y: canvasItem.y },
          layer: {
            zIndex: canvasItem.zIndex,
            scale: canvasItem.scale,
            rotation: canvasItem.rotation,
            visible: canvasItem.visible,
            locked: canvasItem.locked,
            opacity: 1,
          },
          layerAssociations: {
            parentCanvasItemIds: generationMeta.parentIds || [],
            childCanvasItemIds: generationMeta.childIds || [],
          },
          projectId: projectId || undefined,
          projectName: projectName || undefined,
        }),
      }).catch(() => {});

      if (projectId) {
        markDirty();
        saveProjectWorkspaceState(projectId, projectName || 'Untitled');
      }

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
  }, [prompt, negativePrompt, genWidth, genHeight, localApiKey, settings, isAuthenticated, projectId, projectName, startGeneration, completeJob, failJob, addItem, addAssetToFolder, getProjectGeneratedPath, updateAIProvider, markDirty, log, toast]);

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
              onClick={() => { setActiveTab('prompt'); setPromptMode('prompt'); }}
            >
              <Sparkles size={12} />
              {activeTab === 'prompt' && promptMode === 'templates' ? 'Templates' : 'Prompt'}
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

        {/* ─── PROMPT TAB — Template Studio mode ─── */}
        {activeTab === 'prompt' && promptMode === 'templates' && (
          <TemplateStudio
            initialView={templateInitialView}
            isAuthenticated={isAuthenticated}
            onUse={(t) => { setPrompt(t); setPromptMode('prompt'); setShowTemplates(false); }}
            onClose={() => setPromptMode('prompt')}
          />
        )}

        {/* ─── PROMPT TAB — Normal prompt mode ─── */}
        {activeTab === 'prompt' && promptMode === 'prompt' && (
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
                  <PromptTemplatesSection
                    onUse={(t) => { setPrompt(t); setShowTemplates(false); }}
                    isAuthenticated={isAuthenticated}
                    onNewTemplate={() => {
                      setTemplateInitialView('create');
                      setPromptMode('templates');
                    }}
                  />
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
