# ARS TECHNIC AI — Complete Movie Creation Pipeline Plan
# 100 tasks for methodically testing and developing the full workflow:
# Script → Scenes → AI Generation → Overlays → Transitions → Video → Publish
# ============================================================================

## PHASE 1: SCRIPT CREATION & PARSING (Tasks 1–15)
### Input: Raw text or structured script | Output: Validated SceneScript object

1.  [SCRIPT-001] Define ScriptFormat type: screenplay | talking-head | voiceover | commercial | tutorial | story | music-video | documentary
    - Type: enum (8 values)
    - Default: screenplay
    - Validation: must match one of the 8 formats

2.  [SCRIPT-002] Define SceneScript interface with fields: id (UUID), title (string max 200), format (ScriptFormat), scenes (Scene[]), metadata (ScriptMetadata)
    - Type: TypeScript interface
    - Size: unlimited scenes, each scene ~2KB max
    - Error if: empty scenes array, duplicate scene IDs

3.  [SCRIPT-003] Define ScriptMetadata type: author (string), createdAt (ISO timestamp), totalDuration (seconds), targetPlatform (Platform), language (ISO 639-1), version (semver string)
    - Type: TypeScript type
    - Size: ~500 bytes
    - Error if: totalDuration < 1s or > 3600s, invalid language code

4.  [SCRIPT-004] Implement script text input component: <ScriptEditor> with syntax highlighting for SCENE headers, INT./EXT., CHARACTER:, DIALOGUE: markers
    - Type: React functional component
    - Input: raw text (string, unlimited length)
    - Output: parsed script text with visual markers
    - Error handling: show red underline for malformed scene headers, yellow for missing dialogue attribution

5.  [SCRIPT-005] Implement script parser: detectSceneMarkers() using regex for "SCENE X:", "INT. LOCATION - TIME", "EXT. LOCATION - TIME", "## Scene X", numbered "1. Scene Title"
    - Type: pure function
    - Input: rawText (string)
    - Output: { markerType: string, position: number, sceneTitle: string }[]
    - Edge cases: mixed formats, no markers (treat as single scene), emoji in titles

6.  [SCRIPT-006] Implement scene boundary detection: splitScriptIntoScenes(rawText) → rawSceneTexts[]
    - Type: pure function
    - Input: rawText (string, max 100KB)
    - Output: string[] (array of raw scene text blocks)
    - Error if: empty text, text > 100KB (reject with "Script too large, max 100KB")
    - Edge case: single scene script, scenes with no content between markers

7.  [SCRIPT-007] Implement dialogue extraction: extractDialogue(sceneText) → DialogueLine[]
    - Type: pure function
    - Input: sceneText (string)
    - Output: { character: string, text: string, emotion: string, timing: number }[]
    - Patterns: "CHARACTER: text", "CHARACTER (emotion): text", quoted text after character name
    - Error if: dialogue attributed to unknown character (warn, don't block)
    - Size: max 200 dialogue lines per scene

8.  [SCRIPT-008] Implement action/description extraction: extractActions(sceneText) → ActionBlock[]
    - Type: pure function
    - Input: sceneText (string)
    - Output: { description: string, characters: string[], objects: string[], duration: number }[]
    - Heuristic: lines NOT matching dialogue patterns = action descriptions
    - Error if: no actions detected (scene may be dialogue-only, valid)

9.  [SCRIPT-009] Implement character detection from script: detectCharacters(fullScript) → CharacterRef[]
    - Type: pure function
    - Input: fullScript (string)
    - Output: { name: string, firstAppearance: number (scene index), lineCount: number, mentions: number }[]
    - Sort by: lineCount descending (most important first)
    - Error if: zero characters detected (warn "No named characters found")

10. [SCRIPT-010] Implement location/time detection: detectLocations(allScenes) → LocationRef[]
    - Type: pure function
    - Input: allScenes (rawSceneTexts[])
    - Output: { name: string, type: 'INT' | 'EXT', timeOfDay: string, sceneIndices: number[] }[]
    - Patterns: "INT. LOCATION - TIME", "EXT. LOCATION - TIME"
    - Error if: ambiguous INT/EXT (default to INT)

11. [SCRIPT-011] Implement script validation: validateScript(script) → ValidationResult
    - Checks: min 1 scene, max 100 scenes, all characters referenced exist, no duplicate scene numbers, dialogue has attribution, actions have duration estimates, total duration < 1 hour
    - Type: { valid: boolean, errors: ValidationError[], warnings: ValidationWarning[] }
    - Error types: MISSING_DIALOGUE_ATTRIBUTION, DUPLICATE_SCENE, UNKNOWN_CHARACTER, EMPTY_SCENE, SCRIPT_TOO_LONG

12. [SCRIPT-012] Implement script import: importScript(file: File) → SceneScript
    - Supported formats: .txt, .fountain, .md, .json
    - Fountain parser: detect .fountain extension, parse INT./EXT., Character, Dialogue syntax
    - JSON import: validate against SceneScript schema with Zod
    - Error if: unsupported format (list supported), file > 500KB, unparseable content

13. [SCRIPT-013] Implement script export: exportScript(script, format) → Blob
    - Formats: .json (full SceneScript), .txt (plain text), .fountain (screenplay format), .md (markdown)
    - Size: JSON ~10-50KB typical, TXT ~5-30KB
    - Error if: script has 0 scenes (reject export)

14. [SCRIPT-014] Implement script template loader: loadScriptTemplate(templateId) → prefilled SceneScript
    - Templates: "short-film" (5 scenes), "commercial" (3 scenes), "music-video" (8 scenes), "tutorial" (6 scenes), "blank"
    - Type: each template pre-fills format, example scenes with placeholder text
    - Error if: templateId not found (return blank)

15. [SCRIPT-015] Implement script auto-save: debouncedSave(script, interval=3000ms) to localStorage key 'ars:script-draft'
    - Type: hook (useScriptAutoSave)
    - Saves: full SceneScript JSON + lastModified timestamp
    - Recovery: on mount, check 'ars:script-draft', offer restore if newer than current
    - Error if: localStorage full (catch QuotaExceededError, warn user)


## PHASE 2: CHARACTER & LOCATION MANAGEMENT (Tasks 16–25)
### Input: Script characters/locations | Output: Populated CharacterProfile[] and LocationProfile[]

16. [CHAR-001] Define CharacterProfile type: id (UUID), name (string max 100), description (string max 2000), appearance (AppearanceBlock), outfit (OutfitBlock), referenceImages (UUID[]), consistencyScore (0-1)
    - Type: TypeScript interface
    - Size: ~5KB per character with references
    - Error if: name empty, appearance undefined

17. [CHAR-002] Define AppearanceBlock type: gender, age, height, build, skinTone, hairColor, hairStyle, eyeColor, facialFeatures, distinguishing
    - All fields: string, max 200 chars each
    - Validation: at least 3 fields must be non-empty for valid appearance
    - Error if: all fields empty (require minimum description)

18. [CHAR-003] Define LocationProfile type: id (UUID), name (string), type (INT|EXT|INT/EXT), description (string max 1000), timeOfDay (string), lighting (string), props (string[]), referenceImages (UUID[])
    - Type: TypeScript interface
    - Size: ~3KB per location
    - Error if: name empty, type invalid

19. [CHAR-004] Implement character profile editor: <CharacterProfileEditor> component
    - Fields: name, gender (select), age (select), height (text), build (select: slim|athletic|average|muscular|heavy|tall), skinTone (text+color), hairColor (text+color), hairStyle (text), eyeColor (text+color), facialFeatures (textarea), distinguishing (textarea)
    - Type: React component with controlled form
    - Error states: red border on empty required fields, character count for textareas
    - Auto-generate prompt preview: "Full body reference of [name], [gender] [age], [build] build, [hairColor] hair, [eyeColor] eyes..."

20. [CHAR-005] Implement character consistency checker: checkCharacterConsistency(profile, generatedImages) → ConsistencyReport
    - Type: async function calling /api/intelligence/character-consistent
    - Input: CharacterProfile + array of image data URLs
    - Output: { score: 0-1, issues: ConsistencyIssue[], passed: boolean, report: string }
    - Issue types: hairColorMismatch, outfitChange, faceShapeVariation, styleDrift
    - Error if: no reference images provided (cannot check), <2 images (need baseline)

21. [CHAR-006] Implement location profile editor: <LocationProfileEditor> component
    - Fields: name, type (INT|EXT|INT/EXT select), description (textarea), timeOfDay (select: dawn|morning|midday|afternoon|golden-hour|sunset|blue-hour|night|midnight), lighting (select: natural|practical|studio|neon|candle|none), props (tag input)
    - Type: React component
    - Error states: empty name (required), props list overflow (>20 items warn)

22. [CHAR-007] Implement character-to-location assignment: assignCharacterToScene(characterId, sceneId, position, action)
    - Type: store action (useScriptStore)
    - Data: { characterId, sceneId, position: 'center'|'left'|'right'|'foreground'|'background'|'off-screen', action: string }
    - Validation: characterId must exist, sceneId must exist
    - Error if: same character assigned to same position in same scene with different action (merge)

23. [CHAR-008] Implement character sheet batch generation: generateCharacterSheets(profiles[]) → prompt generation for all characters
    - Uses: gen.character.sheet module
    - Output per character: front-standing, side-standing, back-standing, front-portrait, front-action prompts
    - Error if: profile has <3 appearance fields (warn "Incomplete profile, results may vary")
    - Batch size: max 5 characters per batch (API rate limit)

24. [CHAR-009] Implement location reference generation: generateLocationReference(location) → image prompt
    - Uses: enhanced prompt with timeOfDay + lighting + type baked in
    - Output: "Establishing shot of [location.name], [type], [timeOfDay], [lighting] lighting, [description], cinematic, 8K"
    - Error if: location description < 10 chars (use name only)

25. [CHAR-010] Implement asset library linking: linkCharacterToAssets(characterId, assetIds[])
    - Type: store action
    - Links generated character sheets and reference images to character profile
    - Stores in CharacterProfile.referenceImages as UUID[]
    - Error if: assetId doesn't exist in fileStore (skip, warn)
    - Max references: 20 per character


## PHASE 3: SCENE BREAKDOWN & PROMPT GENERATION (Tasks 26–40)
### Input: SceneScript + CharacterProfiles + LocationProfiles | Output: ScenePrompt[] ready for AI generation

26. [SCENE-001] Define ScenePrompt type: id (UUID), sceneNumber (int), sceneTitle (string max 200), description (string max 2000), fullPrompt (string max 4000), shotType (ShotType enum), composition (CompositionType), lighting (string), mood (string), characterPositions (CharacterPosition[]), cameraSettings (CameraSettings), aspectRatio (string), targetWidth (int), targetHeight (int)
    - Type: TypeScript interface
    - Size: ~3KB per scene prompt
    - Validation: sceneNumber unique, fullPrompt < 4000 chars (API limit), targetWidth/targetHeight within 64-2048

27. [SCENE-002] Define ShotType enum: ECU (extreme close-up eyes), CU (close-up face), MCU (medium close-up chest), MS (medium shot waist), MLS (medium long shot knees), WS (wide shot full body), EWS (extreme wide establishing), OTS (over-the-shoulder), POV (point of view), TWO-SHOT, THREE-SHOT, DUTCH (dutch angle), AERIAL (drone/bird's eye), LOW-ANGLE, HIGH-ANGLE
    - 15 shot types
    - Each maps to a prompt suffix: e.g., CU → "close-up portrait, face filling frame, shallow depth of field"

28. [SCENE-003] Define CompositionType: rule-of-thirds | golden-ratio | centered | diagonal | leading-lines | frame-within-frame | symmetry | negative-space | triangular | s-curve
    - 10 composition types
    - Each maps to a composition overlay that can be generated

29. [SCENE-004] Implement scene prompt builder: buildScenePrompt(scene, characters, location, options) → fullPrompt (string)
    - Type: pure function
    - Algorithm:
      1. Start with scene description (truncated to 500 chars)
      2. Append shot type suffix
      3. Append composition guide
      4. Append character positions with actions
      5. Append location description
      6. Append lighting and mood
      7. Append camera/lens specs
      8. Append quality keywords (8K, ultra-detailed, professional)
    - Size: target 500-1500 chars, max 4000
    - Error if: resulting prompt > 4000 (truncate description, warn)

30. [SCENE-005] Implement negative prompt builder: buildNegativePrompt(scene) → negativePrompt (string)
    - Common negatives: "blurry, low quality, distorted, deformed, bad anatomy, watermark, text, logo, oversaturated, extra fingers, mutation"
    - Scene-specific: if outdoor → "indoor lighting"; if portrait → "full body, group shot"; if daytime → "night, dark, moonlight"
    - Size: max 500 chars
    - Error if: negative prompt > 500 (truncate priority order)

31. [SCENE-006] Implement scene prompt preview: <ScenePromptPreview> component
    - Shows: scene number, title, shot type badge, full prompt text, character position overlay thumbnail, estimated generation cost/tokens
    - Type: React component
    - Interactive: click to edit prompt, toggle negative prompt visibility, copy prompt
    - Error states: prompt exceeds API limit (red badge), missing character data (yellow warning)

32. [SCENE-007] Implement batch prompt generation: generateAllScenePrompts(script, characters, locations, style) → ScenePrompt[]
    - Type: async function
    - Input: SceneScript + CharacterProfile[] + LocationProfile[] + style string
    - Output: ScenePrompt[] (one per scene)
    - Progress: emit onProgress(sceneIndex, total) for UI progress bar
    - Error if: any scene has 0 characters AND 0 locations (warn, generate anyway with basic prompt)

33. [SCENE-008] Implement prompt template injection: injectTemplate(prompt, templateId) → filledPrompt
    - Uses: gen.template.engine module
    - If template has {variables}: fill from scene context (character names, locations, times, moods)
    - If template has no variables: concatenate ("prompt, template text")
    - Error if: templateId not found (return unmodified prompt)

34. [SCENE-009] Implement prompt style variation: generateStyleVariations(basePrompt, style) → string[]
    - Adds style-specific suffixes for the same scene
    - Styles: cinematic, anime, photorealistic, oil-painting, watercolor, pixel-art, sketch, cyberpunk, fantasy, minimalist
    - Output: 10 prompt variations (one per style)
    - Error if: style not in AI_STYLES list (default to cinematic)

35. [SCENE-010] Implement prompt optimization: optimizePrompt(prompt) → optimizedPrompt
    - Rules: remove redundant words, add missing quality keywords, fix comma spacing, deduplicate adjectives
    - Heuristic: if no quality keyword present → append "8K, ultra-detailed, professional"
    - Error if: prompt < 20 chars (too short, warn)

36. [SCENE-011] Implement prompt-to-image batch queue: queueScenePrompts(scenePrompts[]) → GenerationJob[]
    - Type: async function calling /api/generate for each scene
    - Rate limit: max 4 concurrent requests, 500ms delay between batches
    - Progress: per-scene onProgress callback
    - Error handling: retry up to 2 times on 429/503, skip on 400, abort all on auth failure
    - Data per request: { prompt, negativePrompt, width, height, apiKey }
    - Size per request: ~2KB JSON

37. [SCENE-012] Implement generation result collector: collectGenerationResults(jobs[]) → SceneImage[]
    - Type: async function
    - Input: GenerationJob[]
    - Output: { sceneId: UUID, imageUrl: string, dataUrl: string, seed: number, assetId: UUID, generatedAt: timestamp }[]
    - Polling: check /api/jobs/[id] every 2s until COMPLETED or FAILED
    - Error if: any job FAILED (mark scene as "generation_failed", offer retry)

38. [SCENE-013] Implement scene image thumbnail strip: <SceneImageStrip> component
    - Shows all generated scene images in chronological order
    - Each thumbnail: image, scene number badge, shot type label, click to expand
    - Drag-drop: reorder scenes by dragging thumbnails
    - Empty state: "No images generated yet" with prompt preview
    - Error state: failed generation shown with red X and retry button

39. [SCENE-014] Implement prompt iteration: iterateScenePrompt(sceneId, feedback) → improved prompt
    - Feedback types: "too dark", "wrong composition", "character missing", "wrong style", "too blurry", "needs more detail"
    - Modifies: negative prompt additions, style adjustments, added detail keywords
    - Output: new ScenePrompt with iterationCount incremented
    - Error if: iterationCount > 5 (warn "Too many iterations, try different approach")

40. [SCENE-015] Implement full script-to-prompts pipeline: <ScriptToPromptsPipeline> orchestrator component
    - Steps: Import/Write script → Parse → Character/location setup → Generate prompts → Review → Generate images → Collect results
    - Visual: stepper UI with 7 steps, current step highlighted
    - Progress: overall percentage + per-step status (pending/active/done/error)
    - Error recovery: any step can be retried independently


## PHASE 4: AI IMAGE GENERATION PIPELINE (Tasks 41–55)
### Input: ScenePrompt[] | Output: GeneratedImage[] with metadata

41. [GEN-001] Define GenerationRequest type: { prompt, negativePrompt?, width, height, provider, model, seed?, steps?, guidanceScale?, referenceImages?, compositionOverlay? }
    - Type: TypeScript interface
    - Size: ~3KB typical
    - Validation: prompt required (1-4000 chars), width/height 64-2048, steps 1-150, guidanceScale 1-30

42. [GEN-002] Implement API key resolution: resolveApiKey() → { key: string, provider: string, model: string }
    - Priority: 1) settingsStore.aiProvider.apiKey, 2) env NEXT_PUBLIC_API_KEY, 3) localStorage 'ars-settings-store'
    - Type: synchronous function
    - Error if: no key found (return empty, caller handles placeholder mode)

43. [GEN-003] Implement provider selection: selectProvider(providerId) → ProviderInstance
    - Providers: GOOGLE_IMAGEN (nanoBanana), OPENAI_DALLE, STABILITY, FAL, REPLICATE
    - Each: { generate: (req) => Promise<{dataUrl, seed}>, validateKey: (key) => Promise<boolean> }
    - Default: GOOGLE_IMAGEN (nanoBanana)
    - Error if: provider disabled or unavailable (fallback to next available)

44. [GEN-004] Implement placeholder generation: generatePlaceholderImage(width, height, seed, prompt) → dataUrl
    - Used when: no API key, or API call fails
    - Sources (priority): 1) picsum.photos (real photos), 2) generated SVG with gradient+shapes, 3) solid color fallback
    - Timeout: 8s for external, instant for SVG
    - Error if: all sources fail (return 1×1 pixel placeholder)

45. [GEN-005] Implement image save to disk: saveImageToDisk(dataUrl, filename) → filePath
    - Type: async function POST /api/generate (server-side save)
    - Path: public/generated/gen_[slug]_[timestamp].png
    - Size limit: 10MB per image (bodyParser config)
    - Error if: disk full (catch, return null, warn user)

46. [GEN-006] Implement image asset registration: registerImageAsset(dataUrl, prompt, metadata) → Asset
    - Stores in: fileStore.assets Map, fileStore file tree under /generated/
    - Metadata: width, height, prompt, model, seed, generatedAt, parentAssetId?, projectIds[]
    - Error if: asset ID collision (generate new UUID)

47. [GEN-007] Implement multi-variant generation: generateVariants(prompt, count, seed) → GeneratedImage[]
    - Same prompt, different seeds → multiple variations
    - Count: 1-16 (configurable)
    - Seeds: increment baseSeed by 1 for each variant
    - Error if: count > 16 (clamp), any variant fails (skip, continue with remaining)

48. [GEN-008] Implement aspect-ratio-aware generation: generateForPlatform(prompt, platform) → GeneratedImage
    - Maps platform to dimensions (tiktok→1080×1920, instagram→1080×1080, youtube→1920×1080, etc.)
    - Also stores: safeZoneInset, maxDuration hint in metadata
    - Error if: unknown platform (default 1024×1024)

49. [GEN-009] Implement generation job tracking: createGenerationJob(request) → Job
    - Job states: QUEUED → PROCESSING → COMPLETED | FAILED | CANCELLED
    - Job data: { id, userId?, projectId?, type, provider, model, prompt, status, progress, resultAssetId?, error?, createdAt, completedAt? }
    - Persistence: prisma.generationJob (authenticated) or in-memory (anonymous)
    - Error if: DB write fails (continue in-memory, degraded mode)

50. [GEN-010] Implement job polling: pollJobStatus(jobId) → JobStatus
    - Polls /api/jobs/[jobId] every 2s
    - Stops when: COMPLETED, FAILED, or CANCELLED
    - Timeout: 5 minutes max per job
    - Error if: network failure during poll (retry 3×, then mark as UNKNOWN)

51. [GEN-011] Implement batch generation with progress: generateBatch(scenePrompts[], onProgress) → GeneratedImage[]
    - Concurrency: max 4 parallel requests
    - Progress: { completed: number, total: number, currentPrompt: string, percent: number }
    - Cancel: AbortController shared across all requests
    - Error if: all requests fail (return partial results with error summary)

52. [GEN-012] Implement image-to-image refinement: refineImage(existingImageUrl, refinementPrompt, strength) → refinedImage
    - Uses gen.image.to.image module
    - Strength: 0 (preserve original) to 1 (full regeneration)
    - Default strength: 0.6
    - Error if: source image URL invalid or inaccessible

53. [GEN-013] Implement character-consistent generation: generateCharacterScene(characterProfile, scenePrompt) → GeneratedImage
    - Prepends character description to scene prompt
    - Appends: "consistent with character reference, same face, same outfit, same build"
    - Uses gen.character.sheet module for reference
    - Error if: character profile has no reference images (warn, generate without consistency guarantee)

54. [GEN-014] Implement generation cost estimation: estimateCost(model, width, height, count) → CostEstimate
    - Approximate token/credit costs per model
    - GOOGLE_IMAGEN: ~$0.02/image @ 1024×1024
    - Display: "Estimated cost: $0.08 for 4 images"
    - Error if: unknown model (return "Unknown cost")

55. [GEN-015] Implement generation history viewer: <GenerationHistory> component
    - Shows all past generations: thumbnail, prompt snippet, date, model, status
    - Filter by: date range, model, project, status
    - Actions: reuse prompt, download image, delete, add to project
    - Pagination: 20 per page, infinite scroll
    - Error state: failed generations with red badge and error message tooltip


## PHASE 5: ASSET OVERLAY & COMPOSITION (Tasks 56–70)
### Input: GeneratedImage[] | Output: ComposedFrame[] with overlaid assets

56. [OVERLAY-001] Define AssetOverlay type: { id: UUID, type: 'subtitle'|'sound'|'effect'|'correction'|'watermark'|'text'|'image'|'drawing', asset: Asset, position: {x,y}, scale: number, opacity: number, startTime: number, endTime: number, zIndex: number }
    - Type: TypeScript interface
    - Size: ~1KB per overlay
    - Validation: startTime < endTime, opacity 0-1, scale 0.01-10

57. [OVERLAY-002] Implement subtitle overlay: <SubtitleOverlay> component
    - Displays: text from scene dialogue at bottom of frame
    - Config: font family, size (8-72), color, outline width, background opacity, position (bottom|top|middle)
    - Timing: synced to scene duration from script
    - Error if: text > 200 chars per frame (truncate or split to multiple overlays)

58. [OVERLAY-003] Implement sound asset overlay: <SoundOverlay> component
    - Visual indicator: waveform icon on frame thumbnail + filename badge
    - Types: dialogue clip, sound effect, music track, ambient
    - Supported formats: .mp3, .wav, .ogg, .aac, .m4a
    - Size limit: 10MB per sound file
    - Error if: unsupported format (show supported list), file too large (>10MB reject)

59. [OVERLAY-004] Implement visual effect overlay: applyEffect(frame, effectType, intensity) → modifiedFrame
    - Effect types: vignette, grain, blur, sharpen, color-grade, glow, shadow, border, lens-flare
    - Intensity: 0-100 slider per effect
    - Stacking: multiple effects can be layered (order matters)
    - Error if: effectType unknown (skip, warn)

60. [OVERLAY-005] Implement correction markup overlay: <CorrectionOverlay> component
    - Drawing-like annotations: arrows, circles, rectangles, freehand lines
    - Colors: red (required change), yellow (suggestion), green (approved)
    - Stores: correction data as JSON drawing commands
    - Error if: no correction data (hide overlay)

61. [OVERLAY-006] Implement watermark overlay: <WatermarkOverlay> component
    - Config: image URL, position (top-left|top-right|bottom-left|bottom-right|center), opacity (5-100%), scale (10-200%)
    - Default: Ars Technic AI logo, bottom-right, 15% opacity
    - Error if: watermark image fails to load (skip, no error)

62. [OVERLAY-007] Implement frame composition viewer: <FrameCompositionViewer> component
    - Shows: base generated image + all overlays rendered together
    - Layer panel: list of overlays with visibility toggle, drag to reorder, opacity slider per layer
    - Zoom/pan: mouse wheel zoom, drag to pan
    - Export: "Export frame as PNG" button
    - Error if: base image fails to load (show placeholder with error message)

63. [OVERLAY-008] Implement composition overlay renderer: renderCompositionOverlay(width, height, compositionType) → SVG overlay
    - Uses edit.composition.overlay module
    - Renders: rule-of-thirds grid or golden ratio or perspective guides etc.
    - Opacity: configurable 10-100%
    - Error if: compositionType unknown (render none)

64. [OVERLAY-009] Implement character position overlay: <CharacterPositionOverlay> component
    - Shows: numbered circles at character positions on frame
    - Labels: character names from script
    - Colors: distinct color per character (auto-assigned from palette)
    - Drag: markers can be moved by dragging
    - Error if: >5 characters (warn, show first 5)

65. [OVERLAY-010] Implement audio waveform visualization: generateWaveformVisual(audioFile) → SVG data URL
    - Shows: amplitude waveform, time ruler, playback position indicator
    - Colors: theme-aware (accent primary for waveform, muted for background)
    - Resolution: 1px per 10ms of audio
    - Error if: audio decode fails (show flat line with error note)

66. [OVERLAY-011] Implement subtitle timing editor: <SubtitleTimeline> component
    - Shows: subtitle track as colored blocks on timeline
    - Drag: resize blocks to adjust timing, drag to reposition
    - Edit: double-click block to edit text
    - Sync: auto-sync subtitles to dialogue timing from script
    - Error if: overlapping subtitle blocks (highlight red, auto-resolve by shifting)

67. [OVERLAY-012] Implement overlay preset system: saveOverlayPreset(name, overlays[]) → preset
    - Saves: current overlay configuration as reusable preset
    - Presets: "cinematic-subtitles", "social-captions", "minimal-watermark", "full-credits"
    - Storage: localStorage 'ars:overlay-presets'
    - Error if: localStorage full (warn)

68. [OVERLAY-013] Implement batch overlay application: applyOverlaysToAllFrames(frames[], overlayTemplate) → composedFrames[]
    - Applies same overlay configuration to all frames
    - Adjusts: subtitle timing per scene duration, watermark consistent across all
    - Progress: per-frame progress callback
    - Error if: frame count > 100 (warn "Large batch, may be slow")

69. [OVERLAY-014] Implement overlay export: exportFrameWithOverlays(frame, format) → Blob
    - Renders: base image + all visible overlays onto a canvas
    - Format: PNG (default), JPEG (quality 90%), WebP (quality 85%)
    - Size: same as base image dimensions
    - Error if: canvas rendering fails (return base image without overlays)

70. [OVERLAY-015] Implement overlay data persistence: saveOverlayState(projectId, frames[]) → void
    - Saves: all overlay configurations per frame to project bundle on disk
    - Format: JSON in .ars-data/projects/{id}/overlays.json
    - Recovery: on project load, restore overlay state
    - Error if: disk write fails (fallback to localStorage)


## PHASE 6: TIMELINE ASSEMBLY & TRANSITIONS (Tasks 71–85)
### Input: ComposedFrame[] + AudioAssets[] | Output: VideoTimeline ready for rendering

71. [TIMELINE-001] Define VideoTimeline type: { id: UUID, frames: TimelineFrame[], tracks: TimelineTrack[], duration: number, fps: number, resolution: {w,h}, transitions: Transition[] }
    - Type: TypeScript interface
    - Size: ~50KB for 20-frame timeline with transitions
    - Validation: fps 12-120, resolution dimensions 64-4096, total duration > 0

72. [TIMELINE-002] Define TimelineFrame type: { id: UUID, sceneId: UUID, imageDataUrl: string, overlays: AssetOverlay[], duration: number, order: number }
    - Duration: from script scene duration, default 5s
    - Order: sequential 0,1,2... can be reordered by drag-drop
    - Error if: imageDataUrl empty (placeholder frame)

73. [TIMELINE-003] Define Transition type: { id: UUID, fromFrameId: UUID, toFrameId: UUID, type: TransitionType, duration: number, easing: EasingType, params: Record<string,number> }
    - TransitionType: fade|dissolve|wipe-left|wipe-right|wipe-up|wipe-down|slide-left|slide-right|zoom-in|zoom-out|flip|cube|glitch|pixelate|blur|none
    - Duration: 0.1s - 5s
    - EasingType: linear|ease-in|ease-out|ease-in-out|bounce|elastic
    - Error if: fromFrameId === toFrameId (self-transition), duration > scene duration

74. [TIMELINE-004] Implement timeline track system: addTrack(type, name) → Track
    - Track types: video (frames), audio (sound clips), subtitle (text blocks), effect (filter keyframes)
    - Multiple tracks: video track A, video track B (for transitions), audio track 1-N, subtitle track
    - Mute/solo per track
    - Error if: duplicate track names (auto-append number)

75. [TIMELINE-005] Implement drag-drop timeline editor: <TimelineEditor> component
    - Horizontal ruler: time in seconds, snap to grid (0.1s intervals)
    - Frame blocks: colored by scene, draggable horizontally to adjust timing, drag to reorder
    - Transition indicators: colored arrows between frame blocks showing type + duration
    - Zoom: mouse wheel to zoom time scale (1s-60s visible range)
    - Error state: overlapping frames (highlight red, prevent drop)

76. [TIMELINE-006] Implement transition presets: <TransitionPicker> component
    - Shows: grid of 15 transition types with animated preview thumbnails
    - Categories: dissolves (fade, dissolve, crossfade), wipes (left/right/up/down), slides (left/right/up/down), zooms (in/out), 3D (flip, cube), effects (glitch, pixelate, blur)
    - Config: duration slider, easing dropdown, preview button
    - Error if: transition type not supported for given frame pair (degrade to fade)

77. [TIMELINE-007] Implement audio track import: importAudioToTimeline(audioFiles[]) → AudioClip[]
    - Supported: .mp3, .wav, .ogg, .aac, .m4a
    - Each clip: waveform preview, volume control, trim handles, fade in/out
    - Sync: align audio to video frames by time
    - Error if: audio duration > video duration (trim or loop option)

78. [TIMELINE-008] Implement subtitle track: <SubtitleTrack> component
    - Text blocks on timeline synced to dialogue
    - Import: from .srt, .vtt, .ass files or script dialogue extraction
    - Edit: inline text editing, timing adjustment by drag
    - Style: per-block or global font/size/color/outline/background
    - Error if: subtitle file parse fails (show line number of error)

79. [TIMELINE-009] Implement timeline playback: playTimeline() → preview
    - Renders: canvas-based preview of current frame + active overlays + transition state
    - Controls: play/pause, seek, frame-by-frame advance/retreat
    - Speed: 0.25x, 0.5x, 1x, 2x
    - Loop: single frame, all frames, selection range
    - Error if: frame image fails to load during playback (skip frame, show error indicator)

80. [TIMELINE-010] Implement timeline project save/load: saveTimeline(projectId), loadTimeline(projectId)
    - Save: serialize VideoTimeline to JSON → POST /api/projects/[id]/timeline
    - Load: GET /api/projects/[id]/timeline → deserialize → restore state
    - Autosave: debounced 5s after last edit
    - Error if: load fails (start with empty timeline, show recovery option)

81. [TIMELINE-011] Implement frame duration calculator: calculateFrameDurations(scenes[]) → durations[]
    - Based on: scene dialogue word count (avg 2.5 words/sec), action description length (avg 1s per 10 words)
    - Minimum: 3s per scene
    - Maximum: 30s per scene (warn if exceeds)
    - Error if: calculated duration < 0.5s (clamp to 3s minimum)

82. [TIMELINE-012] Implement transition auto-suggest: suggestTransitions(scenes[]) → Transition[]
    - Rules: similar scenes → dissolve, location change → wipe, time jump → fade, action scenes → slide, dramatic → zoom
    - Heuristic: if scene mood changes drastically → glitch or pixelate transition
    - Error if: no scenes to transition between (return empty)

83. [TIMELINE-013] Implement timeline export preparation: prepareTimelineForExport(timeline) → ExportManifest
    - Collects: all frame image URLs, all overlay data, all transition configs, audio clip references
    - Bundles: into single JSON manifest for video renderer
    - Size: ~200KB for 20-frame timeline with audio
    - Error if: any frame image missing (warn, use placeholder)

84. [TIMELINE-014] Implement frame reordering by drag-drop: reorderFrames(fromIndex, toIndex) → void
    - Also reorders: associated overlays, transitions, audio clips
    - Constraint: transitions must stay between their two frames
    - Undo: store previous order for Ctrl+Z
    - Error if: fromIndex or toIndex out of bounds (no-op)

85. [TIMELINE-015] Implement timeline validation: validateTimeline(timeline) → ValidationResult
    - Checks: all frames have images, no gaps between frames, transitions valid, audio within bounds, subtitles not overlapping, total duration within limits
    - Output: { valid, errors: [{frameId, issue, severity}], warnings }
    - Error severities: BLOCKING (cannot render), WARNING (can render with issues), INFO


## PHASE 7: VIDEO EXPORT & PUBLISHING (Tasks 86–100)
### Input: ExportManifest | Output: Published video URL on target platform

86. [EXPORT-001] Define ExportConfig type: { format: 'mp4'|'webm'|'mov'|'gif', codec: 'h264'|'h265'|'vp9'|'av1', quality: 1-100, fps: 12-120, resolution: {w,h}, bitrate: number, includeAudio: boolean, burnSubtitles: boolean, watermark?: {image, position} }
    - Type: TypeScript interface
    - Size: ~1KB
    - Validation: format must be supported, codec compatible with format, bitrate > 0

87. [EXPORT-002] Implement platform preset loader: loadPlatformPreset(platform) → ExportConfig
    - Uses: pub.platform.presets module
    - Maps: TikTok→1080×1920 H.264 5-8Mbps, YouTube→1920×1080 H.264 8-12Mbps, etc.
    - Also sets: max duration, safe zone, recommended codec
    - Error if: unknown platform (return default 1080p H.264)

88. [EXPORT-003] Implement video renderer: renderVideo(timeline, config, onProgress) → videoBlob
    - Server-side: uses ffmpeg (fluent-ffmpeg) or client-side: canvas.captureStream + MediaRecorder
    - Progress: { percent, currentFrame, totalFrames, estimatedTimeRemaining }
    - Resolution: frames scaled to config resolution, letterboxed if aspect ratio differs
    - Error handling: ffmpeg not installed (fallback to client-side), frame decode failure (skip frame), audio sync drift (auto-correct)

89. [EXPORT-004] Implement transition rendering in video: renderTransition(frameA, frameB, transitionType, t) → blendedFrame
    - t: 0 (start, frameA) to 1 (end, frameB)
    - Fade: linear opacity blend
    - Wipe: clipping mask moves across frame
    - Slide: frames translate with easing
    - Glitch: random pixel displacement + RGB split
    - Error if: transition type unknown (default to fade)

90. [EXPORT-005] Implement audio mixing: mixAudioTracks(audioClips[], masterVolume) → audioBuffer
    - Mixes: all audio tracks into single stereo track
    - Respects: per-track volume, mute/solo, fade in/out
    - Normalize: optional loudness normalization to -14 LUFS
    - Error if: no audio clips (render video-only, no error)

91. [EXPORT-006] Implement subtitle burn-in: burnSubtitles(frames[], subtitleTrack) → frames[]
    - Renders: subtitle text onto each frame using Canvas API
    - Font: configurable family, size, color, outline, shadow, background box
    - Position: bottom (default), top, middle — safe zone aware
    - Error if: subtitle text contains unsupported characters (render as-is, may show tofu)

92. [EXPORT-007] Implement export progress UI: <ExportProgress> component
    - Shows: progress bar, current frame preview, elapsed time, estimated remaining time, frame count progress
    - Cancel: abort button (terminates ffmpeg process or MediaRecorder)
    - Completion: download button, preview player, "Publish" button
    - Error state: error message with details, retry button, alternative format suggestion

93. [EXPORT-008] Implement video preview player: <VideoPreview> component
    - Plays: exported video blob URL or uploaded URL
    - Controls: play/pause, seek bar, volume, fullscreen, download, speed
    - Overlay: compare with original frames side-by-side toggle
    - Error if: video fails to load (corrupt export, show error + re-export button)

94. [EXPORT-009] Implement multi-format export: exportAllFormats(timeline) → { format: ExportConfig, blob: Blob }[]
    - Exports same timeline in multiple formats: MP4 (H.264), WebM (VP9), GIF (if < 30s)
    - Progress: per-format progress tracking
    - Parallel: 2 concurrent exports max
    - Error if: any format fails (continue with remaining, report failures)

95. [EXPORT-010] Implement export history: <ExportHistory> component
    - Shows: past exports with date, format, duration, file size, platform
    - Actions: download again, delete, re-export with same settings, view in player
    - Storage: export metadata in localStorage, blobs cleared on page unload
    - Error if: blob URL expired (show "File no longer available, re-export")

96. [EXPORT-011] Implement publish to social: publishVideo(videoBlob, platform, metadata) → PublishResult
    - Platforms: TikTok, Instagram, YouTube, X/Twitter, Facebook, LinkedIn
    - Metadata: caption, hashtags, schedule time, thumbnail, privacy setting
    - Flow: upload video → set metadata → schedule or publish immediately
    - Error handling: auth required (redirect to OAuth), rate limited (retry after), file too large (compress suggestion), unsupported format (auto-convert)

97. [EXPORT-012] Implement publish scheduling: schedulePublish(platform, videoBlob, scheduledTime, metadata) → ScheduledPost
    - Stores: scheduled post data in DB
    - Notification: toast when post is published
    - Cancel: cancel scheduled post before publish time
    - Error if: scheduledTime in past (publish immediately), platform auth expired (re-auth prompt)

98. [EXPORT-013] Implement asset cleanup after export: cleanupExportAssets(timeline)
    - Option: delete source frames after successful export (save disk space)
    - Option: keep only final video + 1 thumbnail
    - Warning: "This will delete X MB of source images. Continue?"
    - Error if: deletion fails (skip, warn, don't block)

99. [EXPORT-014] Implement end-to-end pipeline test: testFullPipeline(sampleScript) → PipelineTestResult
    - Test script: 3-scene short film with 2 characters, 1 location, dialogue, actions
    - Validates: script parse → prompts generated → images placeholder-rendered → overlays applied → timeline built → transitions added → video exported
    - Timing: logs duration of each pipeline stage
    - Error report: per-stage pass/fail with details
    - Performance budget: total pipeline < 60s (without real AI generation)

100. [EXPORT-015] Implement pipeline orchestration dashboard: <PipelineDashboard> component
     - Overview: shows all projects in pipeline stage (script/characters/generation/assembly/export/published)
     - Quick actions: "Continue where left off" per project
     - Stats: total projects, images generated, videos exported, publish success rate
     - Empty state: "Start your first movie" with quick-start templates
     - Error state: projects stuck in error stage with "Fix & Retry" button


## PIPELINE DATA FLOW SUMMARY

```
Script (.txt/.fountain/.md)
  │
  ▼
[PHASE 1: Script Parser] ──→ SceneScript { scenes[], characters[], locations[] }
  │                              Data size: ~10-50KB JSON
  │
  ▼
[PHASE 2: Character/Location Profiles] ──→ CharacterProfile[] + LocationProfile[]
  │                                            Data size: ~5KB per character
  │
  ▼
[PHASE 3: Scene Prompt Generator] ──→ ScenePrompt[] { fullPrompt, shotType, composition, lighting, mood }
  │                                      Data size: ~3KB per scene
  │
  ▼
[PHASE 4: AI Image Generation] ──→ GeneratedImage[] { dataUrl, seed, assetId, metadata }
  │                                    Data size: ~2MB per image (1024×1024 PNG)
  │                                    API calls: 1 per scene, max 4 concurrent
  │
  ▼
[PHASE 5: Asset Overlay] ──→ ComposedFrame[] { baseImage + overlays[] }
  │                              Data size: ~2MB per frame
  │
  ▼
[PHASE 6: Timeline Assembly] ──→ VideoTimeline { frames[], transitions[], audioTracks[] }
  │                                  Data size: ~50KB JSON + ~50MB images + ~10MB audio
  │
  ▼
[PHASE 7: Export & Publish] ──→ video.mp4 (H.264, 10-50MB)
                                   → Published URL on target platform
```

## ERROR BOUNDARIES & GRACEFUL DEGRADATION

- Any stage can fail independently → downstream stages use placeholders or skip
- API failures → retry 2×, then use placeholder generation
- Disk full → warn user, continue with in-memory only
- Image load failure → show colored placeholder with error text
- Audio decode failure → silent track
- Transition render failure → use simple fade
- Export failure → offer alternative format or lower quality
- Publish failure → save locally, offer retry with different platform


## PHASE 8: COMFYUI-INSPIRED WORKFLOW ENGINE (Tasks 101–120)
### Source: github.com/Comfy-Org/ComfyUI — Node-based AI image generation workflow
### Input: Workflow graph JSON | Output: Executed generation results

101. [COMFY-001] Define WorkflowGraph type: nodes (WorkflowNode[]), edges (WorkflowEdge[]), metadata (name, author, version, description, tags)
    - Type: TypeScript interface
    - Size: ~10-50KB per workflow JSON
    - Validation: nodes > 0, edges valid, no orphan connections

102. [COMFY-002] ✓ DONE — WorkflowGraphNode type with moduleId binding, params override, status tracking, resultCache. Defined in lib/modules/workflow-graph.ts alongside full WorkflowGraph type. (registry key), title, position {x,y}, params (Record<string,unknown>), status (idle|queued|running|done|error), resultCache
    - Each node maps to exactly one module from the 83-module registry
    - Params override module defaults per-node
    - ResultCache stores output for downstream nodes

103. [COMFY-003] ✓ DONE — New port types added: 'latent', 'conditioning', 'model' in types/module.ts. PortType now has 11 types. Color coding per port type in UI pending. { id, label, type (image|video|audio|3d|text|data|mask|number|latent|conditioning|model), direction (input|output) }
    - New types from ComfyUI: 'latent', 'conditioning', 'model'
    - Port compatibility matrix: which types can connect to which
    - Color coding per port type in UI

104. [COMFY-004] ✓ DONE — gen.model.loader module: 6 model types, 5 built-in models (SD1.5, SDXL, 2 VAEs, CLIP), model info with hash/baseModel/triggerWords, cached loading. lib/modules/generate/model-loader.ts (checkpoint, LoRA, VAE) and exposes it as 'model' port output
    - Model types: CHECKPOINT, LORA, VAE, CLIP, CONTROLNET, UPSCALER
    - Cache loaded models in memory for reuse across nodes
    - Size: models 2-7GB each, loaded lazily

105. [COMFY-005] ✓ DONE — gen.clip.encode module: positive/negative prompt encoding, auto-chunking at 77 tokens, prompt weighting (0-2x), pooled output, token estimation. lib/modules/generate/clip-encode.ts → outputs 'conditioning' for sampler
    - Positive prompt encode (what to generate)
    - Negative prompt encode (what to avoid)
    - Token limit: 77 tokens per chunk, auto-chunk for longer prompts
    - Error if: CLIP model not loaded

106. [COMFY-006] ✓ DONE — gen.image module enhanced: 11 samplers (euler→uni_pc), 6 schedulers (normal→ddim_uniform), CFG 1-30, steps 1-150, seed (-1=random), denoise 0-1 for img2img. lib/modules/generate/image.ts → generates image
    - Parameters: seed, steps (1-150), cfg (1-30), sampler_name, scheduler, denoise (0-1)
    - Samplers: euler, euler_ancestral, heun, dpm_2, dpm_2_ancestral, lms, dpm_fast, dpm_adaptive, dpmpp_2m, dpmpp_sde, uni_pc
    - Schedulers: normal, karras, exponential, sgmuniform, simple, ddim_uniform
    - Error if: seed = -1 (use random), steps < 1

107. [COMFY-007] ✓ DONE — gen.vae.decode module: 5 latent formats (SD1.5/SDXL/SD3/Flux/Inpaint), factor-based dimension calculation, tiled decode option. lib/modules/generate/vae-decode.ts → outputs image
    - Decodes compressed latent representation to visible image
    - Supports: SD1.5, SDXL, SD3, Flux latent formats
    - Error if: latent dimensions don't match VAE expectations

108. [COMFY-008] ✓ DONE — pub.save.preview module: PNG/JPEG/WebP save, workflow metadata embedding in PNG tEXt, auto-filename from timestamp, preview URL output. lib/modules/publish/save-preview.ts → saves to disk and shows preview
    - Save path: /generated/comfy_[timestamp]_[nodeId].png
    - Preview: inline thumbnail in node card
    - Metadata: embed workflow JSON in PNG metadata (tEXt chunk)
    - Error if: disk full (warn, return in-memory only)

109. [COMFY-009] ✓ DONE — gen.controlnet module: 12 control types (canny/depth/normal/openpose/scribble/segmentation/lineart/softedge/shuffle/ip2p/tile/recolor), each with preprocessor, strength 0-1, start/end percent. lib/modules/generate/controlnet.ts → guides generation
    - Control types: canny, depth, normal, openpose, scribble, segmentation, lineart, softedge, shuffle, ip2p, tile, recolor
    - Preprocessor nodes: generate control image from input image
    - Strength: 0-1 (how much control to apply)
    - Error if: control image dimensions don't match generation dimensions

110. [COMFY-010] ✓ DONE — gen.lora.loader: strength -2→2 (negative=inverse), separate model/CLIP strengths, trigger word auto-injection, chainable. lib/modules/generate/lora-loader.ts to model with configurable strength
    - Strength: -2 to 2 (1 = full LoRA, negative = inverse effect)
    - Multiple LoRAs can be chained (sequential application)
    - Weight merging: auto-merge into model before passing downstream
    - Error if: LoRA file not found or incompatible

111. [COMFY-011] ✓ DONE — gen.img2img: encode→denoise→decode pipeline, denoise 0-1, preserveColors/composition toggles, mask input for inpainting, 5 samplers. lib/modules/generate/img2img.ts strength → partial regeneration
    - Encodes input image to latent via VAE encode
    - Denoise: 0 (preserve original) to 1 (full regeneration)
    - Useful for: refinement, style transfer, inpainting
    - Error if: input image fails to decode

112. [COMFY-012] ✓ DONE — edit.upscale.tiled module: 6 upscale models, 2x/4x/8x scales, auto-tiling with configurable tile size and overlap, memory efficiency calculation, tile stitching. lib/modules/edit/upscale-tiled.ts → higher resolution image
    - Models: ESRGAN, RealESRGAN, SwinIR, BSRGAN, 4xUltraSharp
    - Scale factors: 2x, 4x, 8x
    - Tiling: auto-split large images into tiles for memory efficiency
    - Error if: upscale model not loaded, image too large for GPU

113. [COMFY-013] ✓ DONE — intel.face.detailer module: face detection simulation, bounding boxes with landmarks, restoration strength, eye/skin enhancement toggles, face upscale with crop scale. lib/modules/intelligence/face-detailer.ts facial details
    - Detection: YOLO or MTCNN face detection
    - Restoration: CodeFormer or GFPGAN for face enhancement
    - Parameters: detection confidence (0-1), restoration strength (0-1)
    - Error if: no faces detected (pass-through original)

114. [COMFY-014] ✓ DONE — edit.mask.editor module: 7 tools (brush/eraser/fill/rectangle/ellipse/lasso/magic-wand), feather, invert, opacity. SVG-based mask canvas. lib/modules/edit/mask-editor.ts
    - Tools: brush, eraser, fill, rectangle, ellipse, lasso, magic wand
    - Output: grayscale mask where white = keep/modify, black = ignore
    - Feather/blur: soften mask edges (0-100px)
    - Error if: mask dimensions don't match target image

115. [COMFY-015] ✓ DONE — asm.workflow.io module: serialize/deserialize, ComfyUI import with 17 node type mappings, download as .json, drag-drop support. lib/modules/assembly/workflow-io.ts → shareable JSON
    - Embeds: all node params, positions, connections, module versions
    - Excludes: cached results (regenerated on load)
    - Format: standard ComfyUI-compatible JSON with ArsTechnic extensions
    - Drag-drop: load workflow by dropping .json file onto NodeGraph
    - Error if: JSON malformed, missing required fields, module not found in registry

116. [COMFY-016] ✓ DONE — asm.workflow.templates: 6 templates (txt2img/img2img/inpaint/upscale/character-sheet/video-frames), each with full graph nodes+edges, difficulty levels, one-click load. lib/modules/assembly/workflow-templates.ts for common tasks
    - Templates: "txt2img" (prompt→image), "img2img" (image→refine→output), "inpaint" (image+mask→fill), "upscale" (image→upscale→output), "character-sheet" (prompt→multiple views), "video-frames" (prompt→N images→assemble)
    - Load: one-click from template gallery
    - Custom: user can save own workflows as templates
    - Error if: template references missing module (show upgrade prompt)

117. [COMFY-017] ✓ DONE — asm.node.group module: createNodeGroup (collapse), expandNodeGroup (restore), exposed ports, save/load groups as reusable sub-workflow templates. lib/modules/assembly/node-group.ts "Group" node
    - Visual: group nodes show as single box with input/output ports
    - Expand: double-click to expand and edit internals
    - Reuse: groups can be saved as reusable "sub-workflows"
    - Error if: group has no input or no output (can't connect to rest of graph)

118. [COMFY-018] ✓ DONE — gen.batch.prompts module: parse textarea (one prompt per line), skip comments/empty lines, queue through WorkflowQueue with param overrides. lib/modules/generate/batch-prompts.ts
    - UI: textarea with one prompt per line, or CSV import
    - Processing: each line = one job in WorkflowQueue
    - Results: grid view of all outputs with prompt labels
    - Error handling: failed prompts don't block remaining queue

119. [COMFY-019] ✓ DONE — Bezier curves already in ConnLine, PORT_COLORS expanded from 3→11 types (image/video/audio/3d/text/data/mask/number/latent/conditioning/model). Minimap and search pending.
    - Curved bezier connections between ports (not straight lines)
    - Minimap: small overview in corner showing full graph
    - Search: Cmd+F to find nodes by name or module type
    - Zoom: mouse wheel to zoom, middle-drag to pan
    - Error: nodes off-screen detected by minimap

120. [COMFY-020] ✓ DONE — gen.model.manager: 5 models in registry (SD1.5/SDXL/RealVisXL/RealESRGAN/ControlNet), HuggingFace+CivitAI+local sources, download/load/unload/delete actions, model cards with previews/ratings/examples. lib/modules/generate/model-manager.ts
    - Sources: HuggingFace, CivitAI, local files
    - Model types: Checkpoint, LoRA, VAE, ControlNet, Upscaler, CLIP
    - Info: show model card (description, trigger words, example images)
    - Storage: models in ~/.ars-technic/models/ directory
    - Error if: download fails (retry 3x), disk space < 10GB (warn)


## PHASE 9: ARTCRAFT-INSPIRED STORY PIPELINE (Tasks 121–140)
### Source: github.com/storytold/artcraft — Story-driven AI art generation
### Input: Story narrative | Output: Illustrated story with consistent characters

121. [ART-001] Define Story type: id (UUID), title (string), author (string), synopsis (string max 500), chapters (Chapter[]), characters (StoryCharacter[]), styleGuide (StyleGuide), coverImage (UUID?)
    - Type: TypeScript interface
    - Size: ~50KB for full story with 10 chapters
    - Validation: title required, at least 1 chapter, at least 1 character

122. [ART-002] Define Chapter type: id, number, title, scenes (Scene[]), summary, wordCount, targetIllustrations (number of images to generate per chapter)
    - Scenes inherit from existing SceneScript.scenes
    - TargetIllustrations: 1-20 per chapter
    - WordCount: auto-calculated from scene text

123. [ART-003] Define StoryCharacter type (extends CharacterProfile): id, name, role (protagonist|antagonist|supporting|minor|cameo), arc (string describing character journey), firstAppearance (chapter+scene), status (active|dead|missing|transformed)
    - Inherits: appearance, outfit, poses from CharacterProfile
    - Arc: character development across the story
    - Consistency: must look the same in every illustration

124. [ART-004] Define StyleGuide type: artStyle (string), colorPalette (string[]), lineWeight (thin|medium|thick), shading (flat|cel|soft|realistic), atmosphere (string), era (string), referenceArt (UUID[])
    - Applied uniformly across all generated illustrations
    - ColorPalette: 3-8 hex colors defining the story's visual identity
    - ReferenceArt: images that define the "look and feel"

125. [ART-005] ✓ DONE — StoryEditor component: expandable chapter list, scene items with status icons, add/delete chapter/scene, selected scene highlight. components/dashboard/StoryEditor.tsx
    - Left sidebar: chapter list with scene children
    - Main area: text editor with syntax highlighting
    - Drag-drop: reorder chapters, move scenes between chapters
    - Word count: live chapter/scene word counts
    - Error: empty chapter (warn), duplicate scene numbers (auto-fix)

126. [ART-006] Implement character consistency engine: ensure same character looks identical across all generated illustrations
    - Phase 1: generate character reference sheet (front/side/back/portrait/action)
    - Phase 2: for each illustration including this character, prepend character description to prompt
    - Phase 3: check generated image against reference sheet using CLIP similarity
    - Phase 4: if similarity < 0.7, regenerate with stronger character guidance
    - Storage: character embeddings for fast similarity comparison

127. [ART-007] ✓ DONE — intel.scene.illustrator module: 8 key moment types (entrance/confrontation/revelation/climax/resolution/dialogue/action/establishing), regex detection, intensity scoring, forced shot variety (8 types), illustration prompt builder. lib/modules/intelligence/scene-illustrator.ts
    - Key moments: auto-detect dramatic moments (entrance, confrontation, revelation, climax, resolution)
    - Shot variety: force different shot types per illustration (wide, medium, close-up)
    - Composition: apply scene mood to composition (tense = diagonal, peaceful = centered)
    - Error if: scene has no characters or location (generate establishing shot only)

128. [ART-008] Implement style transfer across scenes: apply consistent art style to all illustrations
    - Reference: first illustration sets the style baseline
    - Transfer: subsequent illustrations match the baseline via img2img + style prompt
    - Palette enforcement: post-process to clamp colors to story palette
    - Error if: style transfer degrades image quality (increase denoise strength)

129. [ART-009] ✓ DONE — IllustrationReviewBoard: filterable grid (all/pending/approved/rejected), multi-select batch approve/reject, status dots, similarity scores, per-card approve/reject/regen/expand. components/dashboard/IllustrationReviewBoard.tsx
    - Status: pending, approved, rejected, needs-revision
    - Filter: by chapter, character, status
    - Compare: side-by-side with character reference sheet
    - Batch: approve/reject all in chapter

130. [ART-010] Implement narrative prompt chaining: scene context carries forward
    - Previous scene summary injected into next scene's prompt
    - Character state tracking: injuries, outfit changes, emotional state carry forward
    - Location continuity: if same location as previous scene, mention "continuing from..."
    - Error if: context exceeds prompt length limit (truncate oldest context first)

131. [ART-011] ✓ DONE — StoryboardView component: horizontal scroll per chapter, thumbnails, status dots, expand/collapse, approve/reject/regenerate buttons. components/dashboard/StoryboardView.tsx
    - Layout: horizontal scroll per chapter, vertical stack for all chapters
    - Thumbnails: small preview of each illustration
    - Markers: scene boundaries, character appearances, key moments
    - Click: expand to full-size with prompt and metadata

132. [ART-012] Implement dialogue balloon overlay: auto-place dialogue text on illustrations
    - Detection: match dialogue from script to scene illustration
    - Positions: auto-place near speaking character's head
    - Styles: different balloon shapes per character (round, cloud, spiky, thought)
    - Font: configurable per character voice
    - Error if: character position unknown (place at bottom)

133. [ART-013] ✓ DONE — asm.comic.layout.v2 module: 7 layouts (single/horizontal/vertical/L-shape/4-grid/6-grid/manga), 5 balloon styles, SVG page renderer. lib/modules/assembly/comic-layout-v2.ts
    - Layouts: single (full page), 2-panel (horizontal/vertical), 3-panel (L-shape), 4-panel (2×2), 6-panel (2×3), manga page
    - Gutters: configurable width and color
    - Page numbers: auto-numbered
    - Export: page as single PNG or PDF

134. [ART-014] Implement story export formats: PDF, EPUB, HTML, video slideshow
    - PDF: illustrated storybook with text + images, print-ready
    - EPUB: e-book format with reflowable text
    - HTML: interactive web viewer with chapter navigation
    - Video: auto-advancing slideshow with Ken Burns effect + narration TTS
    - Error if: export format not supported for story length (>100 pages warn)

135. [ART-015] Implement character arc visualization: timeline showing character presence/absence
    - X-axis: chapters/scenes
    - Y-axis: characters (one row each)
    - Markers: appearance, dialogue, key action, death/exit
    - Color: character-specific color
    - Hover: show scene summary

136. [ART-016] ✓ DONE — intel.location.library module: LocationProfile (INT/EXT/INT-EXT), 8 time-of-day, 8 weather, 4 seasons, prompt template builder, consistency scoring, appearance tracking, sorted library. lib/modules/intelligence/location-library.ts
    - Each location: name, type, description, reference images, appearance count
    - Consistency: same location must look the same in every scene
    - Transitions: time of day changes, weather changes, destruction/damage
    - Error if: location description too vague (warn "add more detail for consistency")

137. [ART-017] Implement mood/tone tracker: visualize emotional arc across chapters
    - Per-scene mood: happy, sad, tense, peaceful, dramatic, mysterious, romantic, frightening
    - Graph: line chart showing mood intensity across story
    - Pacing: detect scenes that need illustration (emotional peaks/valleys)
    - Auto-suggest: "This tense scene would benefit from a close-up illustration"

138. [ART-018] ✓ DONE — asm.illustration.video module: Ken Burns effect, parallax, 7 animation types, fade/dissolve transitions, TTS narration synced per frame, auto music mood matching, preview script generation. lib/modules/assembly/illustration-video.ts
    - Ken Burns effect: slow zoom/pan on static illustrations
    - Parallax: separate foreground/background layers for depth
    - Transitions: fade between scenes, wipe for location changes
    - Narration: TTS reads story text synced to illustrations
    - Music: auto-select background music matching scene mood
    - Export: MP4 video with burned-in subtitles

139. [ART-019] Implement story analytics dashboard: word count, illustration count, character stats
    - Total: words, scenes, illustrations, characters, locations
    - Per chapter: word count, illustration count, dominant mood
    - Characters: lines of dialogue, scene appearances, illustration appearances
    - Consistency score: average character similarity across all illustrations
    - Export: analytics as CSV for external tools

140. [ART-020] Implement community sharing: publish stories with illustrations to gallery
    - Public/private toggle per story
    - Thumbnail: auto-generated cover image from first illustration
    - Tags: genre, style, character count, word count
    - Comments: reader feedback on stories
    - Remix: fork another user's story as template
    - Error if: story contains NSFW content without flag (auto-detect and warn)


## PHASE 10: IMPLEMENTATION STATUS & VERIFICATION (Tasks 141–150)

141. [IMPL-001] Graph execution engine: ✓ IMPLEMENTED — topological sort + execute chain in lib/modules/graph-executor.ts
    - Status: COMPLETE. Supports 83 modules, cycle detection, port compatibility, per-node progress.

142. [IMPL-002] Workflow queue system: ✓ IMPLEMENTED — job queue with priority, batch, cancel, retry in lib/modules/workflow-queue.ts
    - Status: COMPLETE. Singleton pattern, pause/resume, progress tracking, stats.

143. [IMPL-003] Module registry: ✓ IMPLEMENTED — 83 modules across 7 categories, all with real execute functions
    - Status: COMPLETE. 0 stubs remaining. Each module has typed ports and parameters.

144. [IMPL-004] Composition overlay generator: ✓ IMPLEMENTED — 12 composition guides with character markers
    - Status: COMPLETE. SVG-based overlays, configurable grid color/opacity.

145. [IMPL-005] Script-to-prompts: ✓ IMPLEMENTED — narrative script → per-scene image prompts
    - Status: COMPLETE. Shot type, lighting, mood, character position detection.

146. [IMPL-006] Character sheet generator: ✓ IMPLEMENTED — mannequin SVG renderer without AI
    - Status: COMPLETE. 12 poses, 7 angles, configurable backgrounds/lighting/camera.

147. [IMPL-007] Drawing canvas: ✓ IMPLEMENTED — 7 tools, color picker, brush size, export
    - Status: COMPLETE. Integrated into home page as collapsible section.

148. [IMPL-008] Template engine: ✓ IMPLEMENTED — 5 built-in templates with typed variable filling
    - Status: COMPLETE. Configurable per template, variable types: text/select/number/color.

149. [IMPL-009] Platform presets: ✓ IMPLEMENTED — 5 platforms, 14 format profiles with safe zones
    - Status: COMPLETE. Dimensions, codec, bitrate, duration limits per platform.

150. [IMPL-010] API collected assets: ✓ IMPLEMENTED — referenceImages + compositionOverlay in /api/generate
    - Status: COMPLETE. Up to 5 reference images, 1 overlay SVG, validated via Zod schema.


## BORROWED CONCEPTS SUMMARY

| Source | Concept | ArsTechnicAI Implementation |
|--------|---------|---------------------------|
| ComfyUI | Node graph with typed ports | NodeGraph + ModuleRegistry (83 modules, 7 port types) |
| ComfyUI | Topological execution | graph-executor.ts (Kahn's algorithm) |
| ComfyUI | Workflow queue | workflow-queue.ts (priority, batch, cancel, retry) |
| ComfyUI | Workflow JSON serialization | Blueprints + workflow save/load |
| ComfyUI | KSampler (steps, CFG, scheduler) | gen.image module parameters |
| ComfyUI | Model loader | AI provider registry (Google, OpenAI, Stability, etc.) |
| ComfyUI | Image preview/save | Generated images grid + disk save |
| ComfyUI | Batch prompt processing | WorkflowQueue with param overrides per job |
| ComfyUI | ControlNet | composition-overlay.ts (guides generation) |
| ComfyUI | Face detailer | intel.detect.faces + character-consistent modules |
| Artcraft | Story → Scene → Image | script-to-prompts.ts pipeline |
| Artcraft | Character consistency | character-consistent.ts + character-sheet.ts |
| Artcraft | Visual storyboarding | Storyboard view + illustration review board |
| Artcraft | Narrative prompt chaining | Scene context carrying forward in prompts |
| Artcraft | Comic layout | asm.comic.layout module |
| Artcraft | Style consistency | StyleGuide + style-transfer module |
| Artcraft | Dialogue balloons | asm.add-captions + subtitle-burn modules |
| Artcraft | Export formats | pub.export (PDF, EPUB, HTML, video) |

