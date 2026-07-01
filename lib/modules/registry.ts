// ============================================================
// ARS TECHNICAI — Module Registry
// Phase 0.1: Registry lists all module IDs from Section 6 (stubs OK)
// ============================================================

import type { ModuleDef, ModuleRegistry } from '@/types/module';

import { moduleDef as mod_asm_add_captions } from './assembly/add-captions';
import { moduleDef as mod_asm_auto_group } from './assembly/auto-group';
import { moduleDef as mod_asm_canvas_compose } from './assembly/canvas-compose';
import { moduleDef as mod_asm_comic_layout_v2 } from './assembly/comic-layout-v2';
import { moduleDef as mod_asm_illustration_video } from './assembly/illustration-video';
import { moduleDef as mod_asm_node_group } from './assembly/node-group';
import { moduleDef as mod_asm_comic_layout } from './assembly/comic-layout';
import { moduleDef as mod_asm_layer_composite } from './assembly/layer-composite';
import { moduleDef as mod_asm_timeline_converter } from './assembly/timeline-converter';
import { moduleDef as mod_asm_timeline_build } from './assembly/timeline-build';
import { moduleDef as mod_asm_video_assemble } from './assembly/video-assemble';
import { moduleDef as mod_asm_workflow_templates } from './assembly/workflow-templates';
import { moduleDef as mod_asm_workflow_io } from './assembly/workflow-io';
import { moduleDef as mod_edit_audio_duck } from './edit/audio-duck';
import { moduleDef as mod_edit_audio_mix } from './edit/audio-mix';
import { moduleDef as mod_edit_audio_normalize } from './edit/audio-normalize';
import { moduleDef as mod_edit_audio_trim } from './edit/audio-trim';
import { moduleDef as mod_edit_background_remove } from './edit/background-remove';
import { moduleDef as mod_edit_background_replace } from './edit/background-replace';
import { moduleDef as mod_edit_blend } from './edit/blend';
import { moduleDef as mod_edit_color_adjust } from './edit/color-adjust';
import { moduleDef as mod_edit_composition_overlay } from './edit/composition-overlay';
import { moduleDef as mod_edit_crop } from './edit/crop';
import { moduleDef as mod_edit_deform } from './edit/deform';
import { moduleDef as mod_edit_filter } from './edit/filter';
import { moduleDef as mod_edit_flip } from './edit/flip';
import { moduleDef as mod_edit_mask_editor } from './edit/mask-editor';
import { moduleDef as mod_edit_mask } from './edit/mask';
import { moduleDef as mod_edit_overlay } from './edit/overlay';
import { moduleDef as mod_edit_pad } from './edit/pad';
import { moduleDef as mod_edit_resize } from './edit/resize';
import { moduleDef as mod_edit_upscale_tiled } from './edit/upscale-tiled';
import { moduleDef as mod_edit_rotate } from './edit/rotate';
import { moduleDef as mod_edit_subtitle_burn } from './edit/subtitle-burn';
import { moduleDef as mod_edit_transition_v2 } from './edit/transition-v2';
import { moduleDef as mod_edit_transition } from './edit/transition';
import { moduleDef as mod_edit_video_overlay } from './edit/video-overlay';
import { moduleDef as mod_edit_video_trim } from './edit/video-trim';
import { moduleDef as mod_edit_drawing } from './edit/drawing';
import { moduleDef as mod_gen_embedding } from './generate/embedding';
import { moduleDef as mod_gen_enhance_prompt } from './generate/enhance-prompt';
import { moduleDef as mod_gen_image } from './generate/image';
import { moduleDef as mod_gen_model_manager } from './generate/model-manager';
import { moduleDef as mod_gen_model_loader } from './generate/model-loader';
import { moduleDef as mod_gen_lora_loader } from './generate/lora-loader';
import { moduleDef as mod_gen_image_to_3d } from './generate/image-to-3d';
import { moduleDef as mod_gen_img2img } from './generate/img2img';
import { moduleDef as mod_gen_image_to_image } from './generate/image-to-image';
import { moduleDef as mod_gen_inpaint } from './generate/inpaint';
import { moduleDef as mod_gen_music } from './generate/music';
import { moduleDef as mod_gen_outpaint } from './generate/outpaint';
import { moduleDef as mod_gen_script } from './generate/script';
import { moduleDef as mod_gen_sfx } from './generate/sfx';
import { moduleDef as mod_gen_storyboard } from './generate/storyboard';
import { moduleDef as mod_gen_style_transfer } from './generate/style-transfer';
import { moduleDef as mod_gen_text_to_3d } from './generate/text-to-3d';
import { moduleDef as mod_gen_tts } from './generate/tts';
import { moduleDef as mod_gen_vae_decode } from './generate/vae-decode';
import { moduleDef as mod_gen_upscale } from './generate/upscale';
import { moduleDef as mod_gen_video } from './generate/video';
import { moduleDef as mod_gen_video_interpolate } from './generate/video-interpolate';
import { moduleDef as mod_gen_controlnet } from './generate/controlnet';
import { moduleDef as mod_gen_batch_prompts } from './generate/batch-prompts';
import { moduleDef as mod_gen_clip_encode } from './generate/clip-encode';
import { moduleDef as mod_gen_character_sheet } from './generate/character-sheet';
import { moduleDef as mod_gen_template_engine } from './generate/template-engine';
import { moduleDef as mod_import_decode_3d } from './ingest/decode-3d';
import { moduleDef as mod_import_decode_audio } from './ingest/decode-audio';
import { moduleDef as mod_import_decode_image } from './ingest/decode-image';
import { moduleDef as mod_import_decode_splat } from './ingest/decode-splat';
import { moduleDef as mod_import_decode_text } from './ingest/decode-text';
import { moduleDef as mod_import_decode_video } from './ingest/decode-video';
import { moduleDef as mod_import_extract_filmstrip } from './ingest/extract-filmstrip';
import { moduleDef as mod_import_extract_metadata } from './ingest/extract-metadata';
import { moduleDef as mod_import_extract_palette } from './ingest/extract-palette';
import { moduleDef as mod_import_extract_waveform } from './ingest/extract-waveform';
import { moduleDef as mod_import_extract_zip } from './ingest/extract-zip';
import { moduleDef as mod_import_generate_thumbnail } from './ingest/generate-thumbnail';
import { moduleDef as mod_import_import_file } from './ingest/import-file';
import { moduleDef as mod_import_import_url } from './ingest/import-url';
import { moduleDef as mod_intel_asset_evolution } from './intelligence/asset-evolution';
import { moduleDef as mod_intel_auto_tag } from './intelligence/auto-tag';
import { moduleDef as mod_intel_character_consistent } from './intelligence/character-consistent';
import { moduleDef as mod_intel_character_replace } from './intelligence/character-replace';
import { moduleDef as mod_intel_face_detailer } from './intelligence/face-detailer';
import { moduleDef as mod_intel_detect_faces } from './intelligence/detect-faces';
import { moduleDef as mod_intel_facial_emotion } from './intelligence/facial-emotion';
import { moduleDef as mod_intel_location_library } from './intelligence/location-library';
import { moduleDef as mod_intel_geo_image } from './intelligence/geo-image';
import { moduleDef as mod_intel_magic_cut } from './intelligence/magic-cut';
import { moduleDef as mod_intel_script_to_shots } from './intelligence/script-to-shots';
import { moduleDef as mod_intel_scene_illustrator } from './intelligence/scene-illustrator';
import { moduleDef as mod_intel_time_space } from './intelligence/time-space';
import { moduleDef as mod_intel_story_manager } from './intelligence/story-manager';
import { moduleDef as mod_intel_states_variables } from './intelligence/states-variables';
import { moduleDef as mod_intel_perf_profiler } from './intelligence/perf-profiler';
import { moduleDef as mod_intel_segment } from './intelligence/segment';
import { moduleDef as mod_intel_script_to_prompts } from './intelligence/script-to-prompts';
import { moduleDef as mod_intel_storyboard_from_prompt } from './intelligence/storyboard-from-prompt';
import { moduleDef as mod_intel_prompt_from_image } from './intelligence/prompt-from-image';
import { moduleDef as mod_pub_apply_format } from './publish/apply-format';
import { moduleDef as mod_pub_export } from './publish/export';
import { moduleDef as mod_pub_save_preview } from './publish/save-preview';
import { moduleDef as mod_pub_schedule } from './publish/schedule';
import { moduleDef as mod_pub_platform_presets } from './publish/platform-presets';
import { moduleDef as mod_3d_animate_model } from './spatial/animate-model';
import { moduleDef as mod_3d_camera_rig } from './spatial/camera-rig';
import { moduleDef as mod_3d_depth_parallax } from './spatial/depth-parallax';
import { moduleDef as mod_3d_lighting } from './spatial/lighting';
import { moduleDef as mod_3d_load_scene } from './spatial/load-scene';
import { moduleDef as mod_3d_new_angle } from './spatial/new-angle';
import { moduleDef as mod_3d_render_3d } from './spatial/render-3d';
import { moduleDef as mod_3d_render_3d_video } from './spatial/render-3d-video';
import { moduleDef as mod_3d_splat_camera } from './spatial/splat-camera';
import { moduleDef as mod_3d_render_mannequin } from './spatial/render-mannequin';

const MODULE_MAP: Record<string, ModuleDef> = {
  'asm.add.captions': mod_asm_add_captions,
  'asm.auto.group': mod_asm_auto_group,
  'asm.canvas.compose': mod_asm_canvas_compose,
  'asm.comic.layout.v2': mod_asm_comic_layout_v2,
  'asm.node.group': mod_asm_node_group,
  'asm.illustration.video': mod_asm_illustration_video,
  'asm.comic.layout': mod_asm_comic_layout,
  'asm.layer.composite': mod_asm_layer_composite,
  'asm.timeline.converter': mod_asm_timeline_converter,
  'asm.timeline.build': mod_asm_timeline_build,
  'asm.video.assemble': mod_asm_video_assemble,
  'asm.workflow.templates': mod_asm_workflow_templates,
  'asm.workflow.io': mod_asm_workflow_io,
  'edit.audio.duck': mod_edit_audio_duck,
  'edit.audio.mix': mod_edit_audio_mix,
  'edit.audio.normalize': mod_edit_audio_normalize,
  'edit.audio.trim': mod_edit_audio_trim,
  'edit.background.remove': mod_edit_background_remove,
  'edit.background.replace': mod_edit_background_replace,
  'edit.blend': mod_edit_blend,
  'edit.color.adjust': mod_edit_color_adjust,
  'edit.composition.overlay': mod_edit_composition_overlay,
  'edit.crop': mod_edit_crop,
  'edit.deform': mod_edit_deform,
  'edit.filter': mod_edit_filter,
  'edit.flip': mod_edit_flip,
  'edit.mask.editor': mod_edit_mask_editor,
  'edit.mask': mod_edit_mask,
  'edit.overlay': mod_edit_overlay,
  'edit.pad': mod_edit_pad,
  'edit.resize': mod_edit_resize,
  'edit.upscale.tiled': mod_edit_upscale_tiled,
  'edit.rotate': mod_edit_rotate,
  'edit.subtitle.burn': mod_edit_subtitle_burn,
  'edit.transition.v2': mod_edit_transition_v2,
  'edit.transition': mod_edit_transition,
  'edit.video.overlay': mod_edit_video_overlay,
  'edit.video.trim': mod_edit_video_trim,
  'edit.drawing': mod_edit_drawing,
  'gen.embedding': mod_gen_embedding,
  'gen.enhance.prompt': mod_gen_enhance_prompt,
  'gen.image': mod_gen_image,
  'gen.model.manager': mod_gen_model_manager,
  'gen.model.loader': mod_gen_model_loader,
  'gen.lora.loader': mod_gen_lora_loader,
  'gen.image.to.3d': mod_gen_image_to_3d,
  'gen.img2img': mod_gen_img2img,
  'gen.image.to.image': mod_gen_image_to_image,
  'gen.inpaint': mod_gen_inpaint,
  'gen.music': mod_gen_music,
  'gen.outpaint': mod_gen_outpaint,
  'gen.script': mod_gen_script,
  'gen.sfx': mod_gen_sfx,
  'gen.storyboard': mod_gen_storyboard,
  'gen.style.transfer': mod_gen_style_transfer,
  'gen.text.to.3d': mod_gen_text_to_3d,
  'gen.tts': mod_gen_tts,
  'gen.vae.decode': mod_gen_vae_decode,
  'gen.upscale': mod_gen_upscale,
  'gen.video': mod_gen_video,
  'gen.video.interpolate': mod_gen_video_interpolate,
  'gen.controlnet': mod_gen_controlnet,
  'gen.batch.prompts': mod_gen_batch_prompts,
  'gen.clip.encode': mod_gen_clip_encode,
  'gen.character.sheet': mod_gen_character_sheet,
  'gen.template.engine': mod_gen_template_engine,
  'import.decode.3d': mod_import_decode_3d,
  'import.decode.audio': mod_import_decode_audio,
  'import.decode.image': mod_import_decode_image,
  'import.decode.splat': mod_import_decode_splat,
  'import.decode.text': mod_import_decode_text,
  'import.decode.video': mod_import_decode_video,
  'import.extract.filmstrip': mod_import_extract_filmstrip,
  'import.extract.metadata': mod_import_extract_metadata,
  'import.extract.palette': mod_import_extract_palette,
  'import.extract.waveform': mod_import_extract_waveform,
  'import.extract.zip': mod_import_extract_zip,
  'import.generate.thumbnail': mod_import_generate_thumbnail,
  'import.import.file': mod_import_import_file,
  'import.import.url': mod_import_import_url,
  'intel.asset.evolution': mod_intel_asset_evolution,
  'intel.auto.tag': mod_intel_auto_tag,
  'intel.character.consistent': mod_intel_character_consistent,
  'intel.character.replace': mod_intel_character_replace,
  'intel.face.detailer': mod_intel_face_detailer,
  'intel.detect.faces': mod_intel_detect_faces,
  'intel.facial.emotion': mod_intel_facial_emotion,
  'intel.location.library': mod_intel_location_library,
  'intel.geo.image': mod_intel_geo_image,
  'intel.magic.cut': mod_intel_magic_cut,
  'intel.script.to.shots': mod_intel_script_to_shots,
  'intel.scene.illustrator': mod_intel_scene_illustrator,
  'intel.time.space': mod_intel_time_space,
  'intel.story.manager': mod_intel_story_manager,
  'intel.states.variables': mod_intel_states_variables,
  'sys.perf.profiler': mod_intel_perf_profiler,
  'intel.segment': mod_intel_segment,
  'intel.script.to.prompts': mod_intel_script_to_prompts,
  'intel.storyboard.from.prompt': mod_intel_storyboard_from_prompt,
  'intel.prompt.from.image': mod_intel_prompt_from_image,
  'pub.apply.format': mod_pub_apply_format,
  'pub.export': mod_pub_export,
  'pub.save.preview': mod_pub_save_preview,
  'pub.schedule': mod_pub_schedule,
  'pub.platform.presets': mod_pub_platform_presets,
  '3d.animate.model': mod_3d_animate_model,
  '3d.camera.rig': mod_3d_camera_rig,
  '3d.depth.parallax': mod_3d_depth_parallax,
  '3d.lighting': mod_3d_lighting,
  '3d.load.scene': mod_3d_load_scene,
  '3d.new.angle': mod_3d_new_angle,
  '3d.render.3d': mod_3d_render_3d,
  '3d.render.3d.video': mod_3d_render_3d_video,
  '3d.splat.camera': mod_3d_splat_camera,
  '3d.render.mannequin': mod_3d_render_mannequin,
};

export const moduleRegistry: ModuleRegistry = {
  get: (id: string) => MODULE_MAP[id],
  list: () => Object.values(MODULE_MAP),
  listByCategory: (category) => Object.values(MODULE_MAP).filter((m) => m.category === category),
  register: (def: ModuleDef) => { MODULE_MAP[def.id] = def; },
  unregister: (id: string) => { delete MODULE_MAP[id]; },
};

export function getModule(id: string): ModuleDef | undefined {
  return MODULE_MAP[id];
}

export function listModules(): ModuleDef[] {
  return Object.values(MODULE_MAP);
}

export function listModulesByCategory(category: ModuleDef['category']): ModuleDef[] {
  return Object.values(MODULE_MAP).filter((m) => m.category === category);
}