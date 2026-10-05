/**
 * Blueprints are reusable workshop graphs. They used to sit in their own
 * store with no page. Compiling one produces pipeline nodes and edges the
 * workshop can show; capturing the workshop writes a blueprint back.
 */
import { v4 as uuidv4 } from 'uuid';
import type { Blueprint, BlueprintCategory, BlueprintConnection, BlueprintNode } from '@/types/blueprint';
import type { PipelineEdge, PipelineNode, PipelineStageId } from '@/types/pipeline';
import { PIPELINE_NODE_DEFS, STAGES, defaultParams, portsCompatible } from '@/lib/pipeline/catalog';

export const PENDING_BLUEPRINT_KEY = 'ars:pending-blueprint';

/** One mark per starter workflow, shared by the picker and the canvas plate. */
export const WORKFLOW_ICONS: Record<string, string> = {
  'bp-starter-key-visual': 'sparkles',
  'bp-starter-spoken-scene': 'mic',
  'bp-starter-storyboard': 'layout-grid',
  'bp-remove-background': 'image-off',
  'bp-new-setting': 'map-pin',
  'bp-restyle': 'palette',
  'bp-relight': 'sun',
  'bp-remove-object': 'eraser',
  'bp-outpaint': 'proportions',
  'bp-upscale': 'maximize',
  'bp-color-grade': 'sliders',
  'bp-repair-portrait': 'wand',
  'bp-sketch-to-frame': 'pencil',
  'bp-character-turnaround': 'contact',
  'bp-prop-on-white': 'box',
  'bp-cover-thumbnail': 'gallery-thumbnails',
  'bp-change-weather': 'cloud-rain',
  'bp-shift-hour': 'clock',
  'bp-add-element': 'plus',
  'bp-day-for-night': 'moon',
  'bp-script-to-board': 'scroll',
  'bp-cover-from-still': 'image',
};

export function workflowIcon(idOrName?: string, name?: string): string {
  if (idOrName && WORKFLOW_ICONS[idOrName]) return WORKFLOW_ICONS[idOrName];
  const spec = STARTER_BLUEPRINTS.find((item) => item.id === idOrName || item.name === idOrName || item.name === name);
  return (spec && WORKFLOW_ICONS[spec.id]) || 'sparkles';
}

export type WorkflowGroup = 'retouch' | 'look' | 'create' | 'story';

export interface WorkflowCard {
  group: WorkflowGroup;
  /** One sentence: what the artist gets. */
  summary: string;
  /** What this graph actually does with the nodes as they run today. */
  honesty: string;
  image: string;
}

export interface BlueprintSpec {
  id: string;
  name: string;
  description: string;
  category: BlueprintCategory;
  nodes: { key: string; type: string; parameters?: Record<string, unknown> }[];
  links: { from: string; fromPort: string; to: string; toPort: string }[];
  card: WorkflowCard;
}

export interface CompiledBlueprint {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  warnings: string[];
}

/** Graphs a new workspace can open from an empty workshop. Node types are catalog ids. */
export const STARTER_BLUEPRINTS: BlueprintSpec[] = [
  {
    id: 'bp-starter-key-visual',
    name: 'Key visual',
    description: 'Moodboard, style, a crafted prompt, and one hero frame.',
    category: 'image',
    card: {
      group: 'create',
      summary: 'A moodboard, a written prompt, and one hero frame in the same look.',
      honesty: 'Moodboard, Prompt Lab, and Key Visual call the model. Style DNA is a form you fill; the prompt does not read it yet. Moodboard frames are sent to Key Visual as reference pictures.',
      image: '/workflow-cards/key-visual.jpg',
    },
    nodes: [
      { key: 'mood', type: 'moodboard-gen', parameters: { theme: 'Storm light on a coastal road, wet asphalt, one warm window' } },
      { key: 'style', type: 'style-dna' },
      { key: 'prompt', type: 'prompt-craft' },
      { key: 'key', type: 'keyframe-gen', parameters: { subject: 'A lone figure under a streetlamp on a wet coastal road' } },
    ],
    links: [
      { from: 'mood', fromPort: 'images', to: 'style', toPort: 'refs' },
      { from: 'mood', fromPort: 'images', to: 'prompt', toPort: 'moodboard' },
      { from: 'style', fromPort: 'style', to: 'key', toPort: 'style' },
      { from: 'prompt', fromPort: 'prompts', to: 'key', toPort: 'prompt' },
    ],
  },
  {
    id: 'bp-starter-spoken-scene',
    name: 'Spoken scene',
    description: 'Logline to script, a still, a motion direction, and dialogue.',
    category: 'video',
    card: {
      group: 'story',
      summary: 'A short scene: the lines, a still of the moment, and a motion direction.',
      honesty: 'Logline, Script, and Key Visual generate. Animate Image asks the image model for a moved still — it does not encode a video. Dialogue writes a performance script for speech; it does not synthesize a voice.',
      image: '/workflow-cards/spoken-scene.jpg',
    },
    nodes: [
      { key: 'log', type: 'logline-gen' },
      { key: 'script', type: 'script-gen' },
      { key: 'key', type: 'keyframe-gen', parameters: { subject: 'Two people across a kitchen table, one of them about to speak' } },
      { key: 'anim', type: 'image-to-video', parameters: { motionPrompt: 'A small breath, a glance, steam rising from a cup. Camera holds.' } },
      { key: 'voice', type: 'dialogue-tts' },
    ],
    links: [
      { from: 'log', fromPort: 'logline', to: 'script', toPort: 'logline' },
      { from: 'script', fromPort: 'script', to: 'key', toPort: 'prompt' },
      { from: 'key', fromPort: 'image', to: 'anim', toPort: 'image' },
      { from: 'script', fromPort: 'script', to: 'voice', toPort: 'script' },
    ],
  },
  {
    id: 'bp-starter-storyboard',
    name: 'Storyboard',
    description: 'Logline, screenplay, shot list, and one board frame.',
    category: 'full-pipeline',
    card: {
      group: 'story',
      summary: 'From a one-line idea to a shot list and a drawn board frame.',
      honesty: 'All four nodes call the model. The logline is passed into the script, the script into the shot list, and the shot list into the board frame.',
      image: '/workflow-cards/storyboard.jpg',
    },
    nodes: [
      { key: 'log', type: 'logline-gen' },
      { key: 'script', type: 'script-gen' },
      { key: 'shots', type: 'shotlist-gen' },
      { key: 'board', type: 'storyboard-frame', parameters: { boardStyle: 'pencil', action: 'The opening image of the scene' } },
    ],
    links: [
      { from: 'log', fromPort: 'logline', to: 'script', toPort: 'logline' },
      { from: 'script', fromPort: 'script', to: 'shots', toPort: 'script' },
      { from: 'shots', fromPort: 'shotlist', to: 'board', toPort: 'shotlist' },
    ],
  },
  {
    id: 'bp-remove-background',
    name: 'Remove background',
    description: 'Drop a picture and paint a plain studio sweep behind the subject.',
    category: 'image',
    card: {
      group: 'retouch',
      summary: 'Lift the subject onto a plain studio sweep.',
      honesty: 'Drop a picture on Import Image, then run AI Edit. It paints a new backdrop. The file that comes back is a flat image, with no transparency.',
      image: '/workflow-cards/remove-background.jpg',
    },
    nodes: [
      { key: 'src', type: 'image-import' },
      { key: 'edit', type: 'image-edit', parameters: {
        operation: 'replace-bg',
        instruction: 'Remove the background. Place the subject on a seamless light-gray studio sweep. Do not change the subject, pose, or crop.',
        strength: 0.85,
      } },
    ],
    links: [
      { from: 'src', fromPort: 'image', to: 'edit', toPort: 'image' },
    ],
  },
  {
    id: 'bp-new-setting',
    name: 'New setting',
    description: 'Keep the subject and invent a place behind them.',
    category: 'image',
    card: {
      group: 'retouch',
      summary: 'Keep the person. Invent the place they stand in.',
      honesty: 'Location Plates generates the place. AI Edit receives your photo plus that plate and repaints the background. You still drop the subject photo yourself.',
      image: '/workflow-cards/new-setting.jpg',
    },
    nodes: [
      { key: 'src', type: 'image-import' },
      { key: 'place', type: 'location-plate-gen', parameters: {
        name: 'Night alley',
        description: 'A narrow wet alley, neon signage, no people, usable as a background plate',
        extra: 'Empty of people. Room for a standing figure in the lower third.',
      } },
      { key: 'edit', type: 'image-edit', parameters: {
        operation: 'replace-bg',
        instruction: 'Replace the background with the reference place. Keep the subject’s identity, pose, and scale. Match the light so they belong there.',
        strength: 0.8,
      } },
    ],
    links: [
      { from: 'src', fromPort: 'image', to: 'edit', toPort: 'image' },
      { from: 'place', fromPort: 'plate', to: 'edit', toPort: 'reference' },
    ],
  },
  {
    id: 'bp-restyle',
    name: 'Restyle',
    description: 'Borrow a look from a moodboard and apply it to your picture.',
    category: 'image',
    card: {
      group: 'look',
      summary: 'Borrow texture, era, and palette from a moodboard.',
      honesty: 'Generate Moodboard makes the reference frames. AI Edit restyles your imported picture toward them and is asked to keep the pose.',
      image: '/workflow-cards/restyle.jpg',
    },
    nodes: [
      { key: 'src', type: 'image-import' },
      { key: 'mood', type: 'moodboard-gen', parameters: { theme: '1970s film stills, warm grain, sodium streetlights, muted reds' } },
      { key: 'edit', type: 'image-edit', parameters: {
        operation: 'restyle',
        instruction: 'Restyle the whole picture into the reference look: grain, palette, and era. Keep the subject’s identity and pose.',
        strength: 0.75,
      } },
    ],
    links: [
      { from: 'src', fromPort: 'image', to: 'edit', toPort: 'image' },
      { from: 'mood', fromPort: 'images', to: 'edit', toPort: 'reference' },
    ],
  },
  {
    id: 'bp-relight',
    name: 'Relight',
    description: 'Change the light on a picture you already have.',
    category: 'image',
    card: {
      group: 'look',
      summary: 'A new key and a rim light, same person, same place.',
      honesty: 'AI Edit relights the imported frame. It is asked to leave the subject and the room alone.',
      image: '/workflow-cards/relight.jpg',
    },
    nodes: [
      { key: 'src', type: 'image-import' },
      { key: 'edit', type: 'image-edit', parameters: {
        operation: 'relight',
        instruction: 'Relight with a soft warm key from frame-left and a cool rim from frame-right. Keep the subject, wardrobe, background, and crop.',
        strength: 0.65,
      } },
    ],
    links: [
      { from: 'src', fromPort: 'image', to: 'edit', toPort: 'image' },
    ],
  },
  {
    id: 'bp-remove-object',
    name: 'Remove an object',
    description: 'Erase something and rebuild what was behind it.',
    category: 'image',
    card: {
      group: 'retouch',
      summary: 'Erase one thing and rebuild the surface behind it.',
      honesty: 'Name the object in the AI Edit instruction, then run it. The node repaints the hole. There is no mask brush on this graph.',
      image: '/workflow-cards/remove-object.jpg',
    },
    nodes: [
      { key: 'src', type: 'image-import' },
      { key: 'edit', type: 'image-edit', parameters: {
        operation: 'remove',
        instruction: 'Remove the distracting object and reconstruct the background that was behind it. Do not move anything else.',
        strength: 0.7,
      } },
    ],
    links: [
      { from: 'src', fromPort: 'image', to: 'edit', toPort: 'image' },
    ],
  },
  {
    id: 'bp-outpaint',
    name: 'Extend the frame',
    description: 'Continue the scene past the original edges.',
    category: 'image',
    card: {
      group: 'retouch',
      summary: 'Continue the scene past the original edges.',
      honesty: 'AI Edit outpaints from the imported picture. The model widens the scene in a new image; it does not change the file’s pixel dimensions by a set factor.',
      image: '/workflow-cards/outpaint.jpg',
    },
    nodes: [
      { key: 'src', type: 'image-import' },
      { key: 'edit', type: 'image-edit', parameters: {
        operation: 'outpaint',
        instruction: 'Extend the scene beyond the original edges, left and right. Continue architecture, light, and ground. Leave the original subject untouched.',
        strength: 0.8,
      } },
    ],
    links: [
      { from: 'src', fromPort: 'image', to: 'edit', toPort: 'image' },
    ],
  },
  {
    id: 'bp-upscale',
    name: 'Upscale',
    description: 'Ask for a sharper, more detailed version of the same frame.',
    category: 'image',
    card: {
      group: 'retouch',
      summary: 'The same frame, with finer detail.',
      honesty: 'Upscale sends the picture to the image model and asks it to recover detail. It is not a dedicated super-resolution model, so edges can be reinterpreted.',
      image: '/workflow-cards/upscale.jpg',
    },
    nodes: [
      { key: 'src', type: 'image-import' },
      { key: 'up', type: 'upscale', parameters: { factor: '2', detailBoost: 0.6, sharpen: 0.35 } },
    ],
    links: [
      { from: 'src', fromPort: 'image', to: 'up', toPort: 'image' },
    ],
  },
  {
    id: 'bp-color-grade',
    name: 'Color grade',
    description: 'Repaint the look of a picture without rebuilding the scene.',
    category: 'image',
    card: {
      group: 'look',
      summary: 'Teal shadows, warm highlights, same scene.',
      honesty: 'Color Grade is an image edit with a look preset. It repaints color. It does not apply a real LUT or write a graded video.',
      image: '/workflow-cards/color-grade.jpg',
    },
    nodes: [
      { key: 'src', type: 'image-import' },
      { key: 'grade', type: 'color-grade', parameters: { look: 'cinematic-teal-orange' } },
    ],
    links: [
      { from: 'src', fromPort: 'image', to: 'grade', toPort: 'image' },
    ],
  },
  {
    id: 'bp-repair-portrait',
    name: 'Repair portrait',
    description: 'Fix the face, then the hands, on a picture you supply.',
    category: 'image',
    card: {
      group: 'retouch',
      summary: 'Face first, then hands, on a portrait you supply.',
      honesty: 'Two AI Edit nodes in a row. The first is asked to fix the face and keep identity. The second is asked to fix the hands and leave the rest.',
      image: '/workflow-cards/repair-portrait.jpg',
    },
    nodes: [
      { key: 'src', type: 'image-import' },
      { key: 'face', type: 'image-edit', parameters: {
        operation: 'face-fix',
        instruction: 'Fix the face: natural eyes, teeth, ears, and skin. Keep identity, expression, and lighting.',
        strength: 0.55,
        preserveIdentity: true,
      } },
      { key: 'hands', type: 'image-edit', parameters: {
        operation: 'hands-fix',
        instruction: 'Fix the hands and fingers so the anatomy is believable. Keep the face, pose, and background.',
        strength: 0.6,
      } },
    ],
    links: [
      { from: 'src', fromPort: 'image', to: 'face', toPort: 'image' },
      { from: 'face', fromPort: 'image', to: 'hands', toPort: 'image' },
    ],
  },
  {
    id: 'bp-sketch-to-frame',
    name: 'Sketch to frame',
    description: 'A rough composition, then the finished still.',
    category: 'image',
    card: {
      group: 'create',
      summary: 'A rough composition, then the finished still.',
      honesty: 'Rough Sketch and Key Visual both generate images, and the sketch is sent into the key frame. Style DNA is wired in as a form; its text is not injected into those prompts yet.',
      image: '/workflow-cards/sketch-to-frame.jpg',
    },
    nodes: [
      { key: 'style', type: 'style-dna' },
      { key: 'sketch', type: 'sketch-gen', parameters: { subject: 'A figure in a doorway, one practical lamp, deep space behind them', sketchStyle: 'pencil' } },
      { key: 'key', type: 'keyframe-gen', parameters: { subject: 'Finish this sketch as a cinematic still. Keep the composition.' } },
    ],
    links: [
      { from: 'style', fromPort: 'style', to: 'sketch', toPort: 'style' },
      { from: 'sketch', fromPort: 'sketch', to: 'key', toPort: 'sketch' },
      { from: 'style', fromPort: 'style', to: 'key', toPort: 'style' },
    ],
  },
  {
    id: 'bp-character-turnaround',
    name: 'Character turnaround',
    description: 'A character bible and a front, side, and back sheet.',
    category: 'image',
    card: {
      group: 'create',
      summary: 'Write who they are. Draw front, side, and back.',
      honesty: 'Character and Style DNA are forms. Character Sheet generates the turnaround and reads the bible text you run on the Character node.',
      image: '/workflow-cards/character-turnaround.jpg',
    },
    nodes: [
      { key: 'who', type: 'character-profile', parameters: {
        name: 'Mara Voss',
        appearance: 'Sharp face, silver streak in dark hair, a scar through the left eyebrow',
        wardrobe: 'Oilskin coat, knitted scarf, heavy boots',
      } },
      { key: 'style', type: 'style-dna' },
      { key: 'sheet', type: 'character-sheet-gen', parameters: { layout: 'turnaround', name: 'Mara Voss' } },
    ],
    links: [
      { from: 'who', fromPort: 'character', to: 'sheet', toPort: 'character' },
      { from: 'style', fromPort: 'style', to: 'sheet', toPort: 'style' },
    ],
  },
  {
    id: 'bp-prop-on-white',
    name: 'Prop on white',
    description: 'Design an object, then isolate it on a white ground.',
    category: 'image',
    card: {
      group: 'create',
      summary: 'Design the object, then isolate it on white.',
      honesty: 'Prop Design generates the sheet. AI Edit then paints a white ground behind it. The result is a flat image.',
      image: '/workflow-cards/prop-on-white.jpg',
    },
    nodes: [
      { key: 'prop', type: 'prop-design', parameters: {
        name: 'Field compass',
        description: 'Pocket compass, worn brass, cracked glass, leather lanyard',
        material: 'brass, glass, leather',
        condition: 'used',
      } },
      { key: 'edit', type: 'image-edit', parameters: {
        operation: 'replace-bg',
        instruction: 'Isolate the object on a pure white background. Keep the object, its angles, and its materials.',
        strength: 0.85,
      } },
    ],
    links: [
      { from: 'prop', fromPort: 'prop', to: 'edit', toPort: 'image' },
    ],
  },
  {
    id: 'bp-cover-thumbnail',
    name: 'Cover thumbnail',
    description: 'A hero frame, then a high-contrast cover image.',
    category: 'image',
    card: {
      group: 'create',
      summary: 'A hero frame, then a cover built from it.',
      honesty: 'Key Visual and Thumbnail both generate images. The hero frame is sent to Thumbnail as a reference picture.',
      image: '/workflow-cards/cover-thumbnail.jpg',
    },
    nodes: [
      { key: 'key', type: 'keyframe-gen', parameters: { subject: 'A close face lit by a single practical, eyes toward camera' } },
      { key: 'thumb', type: 'thumbnail-gen', parameters: { subject: 'The same face, tighter, higher contrast, room for a headline', composition: 'center-face', emotion: 'intrigued' } },
    ],
    links: [
      { from: 'key', fromPort: 'image', to: 'thumb', toPort: 'keyframe' },
    ],
  },
  {
    id: 'bp-change-weather',
    name: 'Change the weather',
    description: 'Keep the shot and change the weather around it.',
    category: 'image',
    card: {
      group: 'retouch',
      summary: 'Same subject, same place, different weather.',
      honesty: 'Drop a picture. AI Edit is asked to bring in rain and wet surfaces and to leave the subject where they are.',
      image: '/workflow-cards/change-weather.jpg',
    },
    nodes: [
      { key: 'src', type: 'image-import' },
      { key: 'edit', type: 'image-edit', parameters: {
        operation: 'weather',
        instruction: 'Change the weather to steady rain. Wet the ground and the air. Keep the subject, pose, and place.',
        strength: 0.7,
      } },
    ],
    links: [{ from: 'src', fromPort: 'image', to: 'edit', toPort: 'image' }],
  },
  {
    id: 'bp-shift-hour',
    name: 'Shift the hour',
    description: 'Move a picture from day into blue hour.',
    category: 'image',
    card: {
      group: 'look',
      summary: 'The same frame, later in the day.',
      honesty: 'Drop a picture. AI Edit moves the light to blue hour and is asked to keep the subject and the place.',
      image: '/workflow-cards/shift-hour.jpg',
    },
    nodes: [
      { key: 'src', type: 'image-import' },
      { key: 'edit', type: 'image-edit', parameters: {
        operation: 'time',
        instruction: 'Move the scene to blue hour. Cool ambient light, practicals just coming on. Keep the subject, pose, and architecture.',
        strength: 0.7,
      } },
    ],
    links: [{ from: 'src', fromPort: 'image', to: 'edit', toPort: 'image' }],
  },
  {
    id: 'bp-add-element',
    name: 'Add an element',
    description: 'Put one new thing into a picture you already have.',
    category: 'image',
    card: {
      group: 'retouch',
      summary: 'Add one object. Leave the rest of the frame alone.',
      honesty: 'Drop a picture and edit the instruction to name what you want added. AI Edit paints it into the existing light.',
      image: '/workflow-cards/add-element.jpg',
    },
    nodes: [
      { key: 'src', type: 'image-import' },
      { key: 'edit', type: 'image-edit', parameters: {
        operation: 'add',
        instruction: 'Add a single practical lamp in the midground. Match the existing light and perspective. Do not move the subject.',
        strength: 0.65,
      } },
    ],
    links: [{ from: 'src', fromPort: 'image', to: 'edit', toPort: 'image' }],
  },
  {
    id: 'bp-day-for-night',
    name: 'Day for night',
    description: 'Grade a daylight picture so it reads as night.',
    category: 'image',
    card: {
      group: 'look',
      summary: 'A daylight plate, graded to read as night.',
      honesty: 'Color Grade repaints the imported picture with the day-for-night look. It does not relight a real scene or write a video.',
      image: '/workflow-cards/day-for-night.jpg',
    },
    nodes: [
      { key: 'src', type: 'image-import' },
      { key: 'grade', type: 'color-grade', parameters: { look: 'day-for-night' } },
    ],
    links: [{ from: 'src', fromPort: 'image', to: 'grade', toPort: 'image' }],
  },
  {
    id: 'bp-script-to-board',
    name: 'Script to board',
    description: 'Paste a screenplay, then a shot list and one board frame.',
    category: 'full-pipeline',
    card: {
      group: 'story',
      summary: 'Paste a script. Get a shot list and a board frame.',
      honesty: 'You paste the screenplay on Import Script. Shot List reads that text, and Storyboard Frames reads the shot list. Both of those call the model.',
      image: '/workflow-cards/script-to-board.jpg',
    },
    nodes: [
      { key: 'script', type: 'script-import' },
      { key: 'shots', type: 'shotlist-gen' },
      { key: 'board', type: 'storyboard-frame', parameters: { boardStyle: 'pencil', action: 'The first image the shot list asks for' } },
    ],
    links: [
      { from: 'script', fromPort: 'script', to: 'shots', toPort: 'script' },
      { from: 'shots', fromPort: 'shotlist', to: 'board', toPort: 'shotlist' },
    ],
  },
  {
    id: 'bp-cover-from-still',
    name: 'Cover from a still',
    description: 'Turn a picture you already have into a cover image.',
    category: 'image',
    card: {
      group: 'create',
      summary: 'Your still, tightened into a cover.',
      honesty: 'Drop a picture. Thumbnail generates a higher-contrast cover and receives that picture as its reference.',
      image: '/workflow-cards/cover-from-still.jpg',
    },
    nodes: [
      { key: 'src', type: 'image-import' },
      { key: 'thumb', type: 'thumbnail-gen', parameters: {
        subject: 'A tighter, higher-contrast cover of this still',
        composition: 'center-face',
        emotion: 'intrigued',
      } },
    ],
    links: [{ from: 'src', fromPort: 'image', to: 'thumb', toPort: 'keyframe' }],
  },
];

export const WORKFLOW_GROUPS: { id: WorkflowGroup; title: string; blurb: string }[] = [
  { id: 'retouch', title: 'Change a picture', blurb: 'You bring the frame. The edit nodes repaint it.' },
  { id: 'look', title: 'Change the look', blurb: 'Light, grade, or a borrowed style on a picture you have.' },
  { id: 'create', title: 'Make a picture', blurb: 'Start from a description and generate the frames.' },
  { id: 'story', title: 'Tell the scene', blurb: 'Words first, then a still or a board.' },
];

export function specToBlueprint(spec: BlueprintSpec): Blueprint {
  const nodes: BlueprintNode[] = spec.nodes.map((node) => ({
    id: node.key,
    moduleId: node.type,
    x: 0,
    y: 0,
    parameters: node.parameters ?? {},
  }));
  const connections: BlueprintConnection[] = spec.links.map((link, index) => ({
    id: `${spec.id}-c${index}`,
    fromNodeId: link.from,
    fromPort: link.fromPort,
    toNodeId: link.to,
    toPort: link.toPort,
  }));
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    category: spec.category,
    nodes,
    connections,
    parameters: [],
    version: '1.0.0',
    createdAt: 0,
    updatedAt: 0,
  };
}

function laneFallback(stage: PipelineStageId, slot: number): { x: number; y: number } {
  const order = STAGES[stage]?.order ?? 0;
  return { x: order * 430 + 24, y: 76 + slot * 256 };
}

/** A blueprint node at 0,0 has not been placed; the workshop lanes it by stage. */
function isUnplaced(node: BlueprintNode): boolean {
  return node.x === 0 && node.y === 0;
}

export function compileBlueprint(bp: Blueprint): CompiledBlueprint {
  const warnings: string[] = [];
  const idMap = new Map<string, string>();
  const slotByStage: Partial<Record<PipelineStageId, number>> = {};
  const nodes: PipelineNode[] = [];

  for (const source of bp.nodes) {
    const def = PIPELINE_NODE_DEFS[source.moduleId];
    if (!def) {
      warnings.push(`Unknown node “${source.moduleId}” was left out.`);
      continue;
    }
    const id = uuidv4();
    idMap.set(source.id, id);
    const slot = slotByStage[def.stage] ?? 0;
    slotByStage[def.stage] = slot + 1;
    const placed = !isUnplaced(source);
    nodes.push({
      id,
      type: source.moduleId,
      stage: def.stage,
      title: def.title,
      slot,
      x: placed ? source.x : undefined,
      y: placed ? source.y : undefined,
      params: { ...defaultParams(def), ...source.parameters },
      status: 'idle',
      variants: [],
    });
  }

  const edges: PipelineEdge[] = [];
  for (const connection of bp.connections) {
    const from = idMap.get(connection.fromNodeId);
    const to = idMap.get(connection.toNodeId);
    if (!from || !to) {
      warnings.push('A link was dropped because its node is not in the workshop catalog.');
      continue;
    }
    const fromNode = nodes.find((node) => node.id === from);
    const toNode = nodes.find((node) => node.id === to);
    const fromDef = fromNode ? PIPELINE_NODE_DEFS[fromNode.type] : undefined;
    const toDef = toNode ? PIPELINE_NODE_DEFS[toNode.type] : undefined;
    const fromPort = fromDef?.outputs.find((port) => port.id === connection.fromPort);
    const toPort = toDef?.inputs.find((port) => port.id === connection.toPort);
    if (!fromPort || !toPort || !portsCompatible(fromPort.type, toPort.type)) {
      warnings.push(`Link ${connection.fromPort} → ${connection.toPort} does not fit and was dropped.`);
      continue;
    }
    edges.push({
      id: uuidv4(),
      from,
      fromPort: connection.fromPort,
      to,
      toPort: connection.toPort,
      type: fromPort.type,
    });
  }

  return { nodes, edges, warnings };
}

export function graphToBlueprint(
  nodes: PipelineNode[],
  edges: PipelineEdge[],
  meta: { name: string; category: BlueprintCategory; description?: string },
): Blueprint {
  const now = Date.now();
  return {
    id: uuidv4(),
    name: meta.name,
    description: meta.description,
    category: meta.category,
    version: '1.0.0',
    createdAt: now,
    updatedAt: now,
    parameters: [],
    nodes: nodes.map((node) => {
      const at = node.x !== undefined && node.y !== undefined
        ? { x: node.x, y: node.y }
        : laneFallback(node.stage, node.slot);
      return {
        id: node.id,
        moduleId: node.type,
        x: at.x,
        y: at.y,
        parameters: { ...node.params },
      };
    }),
    connections: edges.map((edge) => ({
      id: edge.id,
      fromNodeId: edge.from,
      fromPort: edge.fromPort,
      toNodeId: edge.to,
      toPort: edge.toPort,
    })),
  };
}

export function inferCategory(nodes: { type: string }[]): BlueprintCategory {
  const stages = new Set(nodes.map((node) => PIPELINE_NODE_DEFS[node.type]?.stage).filter(Boolean));
  if (stages.has('motion') || stages.has('assembly') || stages.has('delivery')) return 'video';
  if (stages.has('audio') && !stages.has('visual')) return 'audio';
  if (stages.size >= 4) return 'full-pipeline';
  return 'image';
}
