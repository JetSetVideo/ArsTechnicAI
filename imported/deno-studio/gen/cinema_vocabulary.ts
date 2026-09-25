/**
 * cinema_vocabulary.ts — GENERATED. Do not edit.
 *
 * Source: library/cinema/vocabulary.json
 * Regenerate: deno task codegen
 *
 * 35 closed vocabularies, 573 terms: every camera body, lens family,
 * film stock, lighting instrument, movement, mood and composition the rules engine
 * quantifies over. A union rather than an enum so a term is its own literal and a
 * misspelling cannot reach a set-membership test.
 */

// --------------------------------------------------------------------------
// animation
// --------------------------------------------------------------------------

/** 4 terms. */
export type AnimationMedium =
  | "2D"
  | "3D"
  | "Hybrid"
  | "StopMotion";
export const ANIMATION_MEDIUM_VALUES: readonly AnimationMedium[] = Object.freeze([
  "2D",
  "3D",
  "Hybrid",
  "StopMotion",
]);

/** 11 terms. */
export type AnimePreset =
  | "Studio_Ghibli"
  | "Akira"
  | "Ghost_in_the_Shell"
  | "Evangelion"
  | "Makoto_Shinkai"
  | "Kyoto_Animation"
  | "MAPPA"
  | "Wit_Studio"
  | "Ufotable"
  | "Trigger"
  | "Gainax";
export const ANIME_PRESET_VALUES: readonly AnimePreset[] = Object.freeze([
  "Studio_Ghibli",
  "Akira",
  "Ghost_in_the_Shell",
  "Evangelion",
  "Makoto_Shinkai",
  "Kyoto_Animation",
  "MAPPA",
  "Wit_Studio",
  "Ufotable",
  "Trigger",
  "Gainax",
]);

/** 8 terms. */
export type ColorApplication =
  | "Flat"
  | "Cel"
  | "Soft"
  | "Painterly"
  | "Monochrome"
  | "Monochrome_Ink"
  | "Limited"
  | "Full";
export const COLOR_APPLICATION_VALUES: readonly ColorApplication[] = Object.freeze([
  "Flat",
  "Cel",
  "Soft",
  "Painterly",
  "Monochrome",
  "Monochrome_Ink",
  "Limited",
  "Full",
]);

/** 5 terms. */
export type IllustrationPreset =
  | "Concept_Art"
  | "Editorial"
  | "Book_Illustration"
  | "Comic_Western"
  | "Graphic_Novel";
export const ILLUSTRATION_PRESET_VALUES: readonly IllustrationPreset[] = Object.freeze([
  "Concept_Art",
  "Editorial",
  "Book_Illustration",
  "Comic_Western",
  "Graphic_Novel",
]);

/** 10 terms. */
export type LightingModel =
  | "Symbolic"
  | "Graphic"
  | "Graphic_Light"
  | "Naturalistic_Simulated"
  | "Stylized_Rim"
  | "Glow"
  | "Glow_Emission"
  | "Minimal"
  | "Flat_Light"
  | "Dramatic";
export const LIGHTING_MODEL_VALUES: readonly LightingModel[] = Object.freeze([
  "Symbolic",
  "Graphic",
  "Graphic_Light",
  "Naturalistic_Simulated",
  "Stylized_Rim",
  "Glow",
  "Glow_Emission",
  "Minimal",
  "Flat_Light",
  "Dramatic",
]);

/** 5 terms. */
export type LineTreatment =
  | "Clean"
  | "Variable"
  | "Inked"
  | "Sketchy"
  | "None";
export const LINE_TREATMENT_VALUES: readonly LineTreatment[] = Object.freeze([
  "Clean",
  "Variable",
  "Inked",
  "Sketchy",
  "None",
]);

/** 5 terms. */
export type MangaPreset =
  | "Shonen"
  | "Dark_Seinen"
  | "Shojo"
  | "Josei"
  | "Horror_Manga";
export const MANGA_PRESET_VALUES: readonly MangaPreset[] = Object.freeze([
  "Shonen",
  "Dark_Seinen",
  "Shojo",
  "Josei",
  "Horror_Manga",
]);

/** 7 terms. */
export type MotionStyle =
  | "None"
  | "Limited"
  | "Full"
  | "Exaggerated"
  | "Snappy"
  | "Fluid"
  | "Rotoscoped";
export const MOTION_STYLE_VALUES: readonly MotionStyle[] = Object.freeze([
  "None",
  "Limited",
  "Full",
  "Exaggerated",
  "Snappy",
  "Fluid",
  "Rotoscoped",
]);

/** 8 terms. */
export type StyleDomain =
  | "Anime"
  | "Manga"
  | "ThreeD"
  | "Illustration"
  | "Western_Animation"
  | "Graphic_Novel"
  | "Painterly"
  | "Concept_Art";
export const STYLE_DOMAIN_VALUES: readonly StyleDomain[] = Object.freeze([
  "Anime",
  "Manga",
  "ThreeD",
  "Illustration",
  "Western_Animation",
  "Graphic_Novel",
  "Painterly",
  "Concept_Art",
]);

/** 6 terms. */
export type SurfaceDetail =
  | "Flat"
  | "Painterly"
  | "Smooth"
  | "Photoreal"
  | "Textured"
  | "Hatched";
export const SURFACE_DETAIL_VALUES: readonly SurfaceDetail[] = Object.freeze([
  "Flat",
  "Painterly",
  "Smooth",
  "Photoreal",
  "Textured",
  "Hatched",
]);

/** 7 terms. */
export type ThreeDPreset =
  | "Pixar"
  | "Dreamworks"
  | "Disney_3D"
  | "Arcane"
  | "Spider_Verse"
  | "Unreal_Cinematic"
  | "Blender_Stylized";
export const THREE_DPRESET_VALUES: readonly ThreeDPreset[] = Object.freeze([
  "Pixar",
  "Dreamworks",
  "Disney_3D",
  "Arcane",
  "Spider_Verse",
  "Unreal_Cinematic",
  "Blender_Stylized",
]);

/** 7 terms. */
export type VirtualCamera =
  | "Locked"
  | "Digital_Pan"
  | "Digital_Zoom"
  | "Parallax"
  | "Free_3D"
  | "Simulated_Handheld"
  | "Motion_Comic";
export const VIRTUAL_CAMERA_VALUES: readonly VirtualCamera[] = Object.freeze([
  "Locked",
  "Digital_Pan",
  "Digital_Zoom",
  "Parallax",
  "Free_3D",
  "Simulated_Handheld",
  "Motion_Comic",
]);

// --------------------------------------------------------------------------
// common
// --------------------------------------------------------------------------

/** 13 terms. */
export type ColorTone =
  | "Warm_Saturated"
  | "Warm_Desaturated"
  | "Cool_Saturated"
  | "Cool_Desaturated"
  | "Neutral_Saturated"
  | "Neutral_Desaturated"
  | "Monochrome"
  | "Sepia"
  | "Teal_Orange"
  | "Cross_Processed"
  | "Bleach_Bypass"
  | "High_Contrast_BW"
  | "Low_Contrast_BW";
export const COLOR_TONE_VALUES: readonly ColorTone[] = Object.freeze([
  "Warm_Saturated",
  "Warm_Desaturated",
  "Cool_Saturated",
  "Cool_Desaturated",
  "Neutral_Saturated",
  "Neutral_Desaturated",
  "Monochrome",
  "Sepia",
  "Teal_Orange",
  "Cross_Processed",
  "Bleach_Bypass",
  "High_Contrast_BW",
  "Low_Contrast_BW",
]);

/** 67 terms. */
export type Composition =
  | "Rule_of_Thirds"
  | "Centered"
  | "Symmetrical"
  | "Asymmetrical"
  | "Negative_Space"
  | "Leading_Lines"
  | "Frame_Within_Frame"
  | "Diagonal"
  | "Golden_Ratio"
  | "Golden_Spiral"
  | "Dynamic_Symmetry"
  | "Radial_Balance"
  | "Headroom"
  | "Lead_Room"
  | "Fill_The_Frame"
  | "Depth_Layering"
  | "Abstract"
  | "Action_Lines"
  | "Aggressive_Closeups"
  | "Architectural"
  | "Architectural_Symmetry"
  | "Centered_Action"
  | "Cinematic"
  | "Classic_Composition"
  | "Claustrophobic"
  | "Comic_Panels"
  | "Constrained_Framing"
  | "Decorative"
  | "Deep_Focus"
  | "Disorienting_Framing"
  | "Disruptive"
  | "Documentary_Style"
  | "Dramatic_Angles"
  | "Dynamic"
  | "Dynamic_Blocking"
  | "Dynamic_Framing"
  | "Extreme_Close_Up"
  | "Geometric"
  | "Handheld_Frames"
  | "High_Contrast"
  | "Iconic_Silhouettes"
  | "Improvised"
  | "Industrial_Frames"
  | "Intimate"
  | "Intimate_Framing"
  | "Low_Angle"
  | "Minimalist"
  | "Observational"
  | "Organic"
  | "Organic_Framing"
  | "Organic_Wide_Frames"
  | "Overdesigned_Frames"
  | "POV_Framing"
  | "Painterly"
  | "Playful_Framing"
  | "Poetic"
  | "Rough_Framing"
  | "Scale_Emphasis"
  | "Static"
  | "Storybook"
  | "Street_Level"
  | "Urban"
  | "Venetian_Blinds"
  | "Wide_Angle_Centered"
  | "Wide_Frames"
  | "Wide_Static_Frames"
  | "Wide_Symmetrical";
export const COMPOSITION_VALUES: readonly Composition[] = Object.freeze([
  "Rule_of_Thirds",
  "Centered",
  "Symmetrical",
  "Asymmetrical",
  "Negative_Space",
  "Leading_Lines",
  "Frame_Within_Frame",
  "Diagonal",
  "Golden_Ratio",
  "Golden_Spiral",
  "Dynamic_Symmetry",
  "Radial_Balance",
  "Headroom",
  "Lead_Room",
  "Fill_The_Frame",
  "Depth_Layering",
  "Abstract",
  "Action_Lines",
  "Aggressive_Closeups",
  "Architectural",
  "Architectural_Symmetry",
  "Centered_Action",
  "Cinematic",
  "Classic_Composition",
  "Claustrophobic",
  "Comic_Panels",
  "Constrained_Framing",
  "Decorative",
  "Deep_Focus",
  "Disorienting_Framing",
  "Disruptive",
  "Documentary_Style",
  "Dramatic_Angles",
  "Dynamic",
  "Dynamic_Blocking",
  "Dynamic_Framing",
  "Extreme_Close_Up",
  "Geometric",
  "Handheld_Frames",
  "High_Contrast",
  "Iconic_Silhouettes",
  "Improvised",
  "Industrial_Frames",
  "Intimate",
  "Intimate_Framing",
  "Low_Angle",
  "Minimalist",
  "Observational",
  "Organic",
  "Organic_Framing",
  "Organic_Wide_Frames",
  "Overdesigned_Frames",
  "POV_Framing",
  "Painterly",
  "Playful_Framing",
  "Poetic",
  "Rough_Framing",
  "Scale_Emphasis",
  "Static",
  "Storybook",
  "Street_Level",
  "Urban",
  "Venetian_Blinds",
  "Wide_Angle_Centered",
  "Wide_Frames",
  "Wide_Static_Frames",
  "Wide_Symmetrical",
]);

/** 89 terms. */
export type Mood =
  | "Cheerful"
  | "Hopeful"
  | "Whimsical"
  | "Romantic"
  | "Euphoric"
  | "Serene"
  | "Playful"
  | "Triumphant"
  | "Nostalgic"
  | "Tender"
  | "Adventurous"
  | "Bold"
  | "Energetic"
  | "Contemplative"
  | "Melancholic"
  | "Bittersweet"
  | "Mysterious"
  | "Surreal"
  | "Dreamlike"
  | "Ethereal"
  | "Introspective"
  | "Ambiguous"
  | "Detached"
  | "Atmospheric"
  | "Cinematic"
  | "Conceptual"
  | "Emotional"
  | "Philosophical"
  | "Realistic"
  | "Satirical"
  | "Somber"
  | "Stylized"
  | "Tactile"
  | "Tense"
  | "Suspenseful"
  | "Anxious"
  | "Paranoid"
  | "Claustrophobic"
  | "Ominous"
  | "Menacing"
  | "Dread"
  | "Foreboding"
  | "Uneasy"
  | "Suspicious"
  | "Unsettling"
  | "Gloomy"
  | "Tragic"
  | "Despairing"
  | "Lonely"
  | "Desolate"
  | "Haunting"
  | "Eerie"
  | "Oppressive"
  | "Nihilistic"
  | "Bleak"
  | "Dark"
  | "Aggressive"
  | "Chaotic"
  | "Frantic"
  | "Intense"
  | "Urgent"
  | "Explosive"
  | "Angry"
  | "Brutal"
  | "Dramatic"
  | "Gritty"
  | "Psychological"
  | "Erotic"
  | "Noir"
  | "Gothic"
  | "Documentary"
  | "Epic"
  | "Intimate"
  | "Absurd"
  | "Alienated"
  | "Apocalyptic"
  | "Controlled"
  | "Cool"
  | "Decadent"
  | "Existential"
  | "Hallucinatory"
  | "Meditative"
  | "Obsessive"
  | "Provocative"
  | "Rebellious"
  | "Tragicomic"
  | "Transcendent"
  | "Traumatic"
  | "Unhinged";
export const MOOD_VALUES: readonly Mood[] = Object.freeze([
  "Cheerful",
  "Hopeful",
  "Whimsical",
  "Romantic",
  "Euphoric",
  "Serene",
  "Playful",
  "Triumphant",
  "Nostalgic",
  "Tender",
  "Adventurous",
  "Bold",
  "Energetic",
  "Contemplative",
  "Melancholic",
  "Bittersweet",
  "Mysterious",
  "Surreal",
  "Dreamlike",
  "Ethereal",
  "Introspective",
  "Ambiguous",
  "Detached",
  "Atmospheric",
  "Cinematic",
  "Conceptual",
  "Emotional",
  "Philosophical",
  "Realistic",
  "Satirical",
  "Somber",
  "Stylized",
  "Tactile",
  "Tense",
  "Suspenseful",
  "Anxious",
  "Paranoid",
  "Claustrophobic",
  "Ominous",
  "Menacing",
  "Dread",
  "Foreboding",
  "Uneasy",
  "Suspicious",
  "Unsettling",
  "Gloomy",
  "Tragic",
  "Despairing",
  "Lonely",
  "Desolate",
  "Haunting",
  "Eerie",
  "Oppressive",
  "Nihilistic",
  "Bleak",
  "Dark",
  "Aggressive",
  "Chaotic",
  "Frantic",
  "Intense",
  "Urgent",
  "Explosive",
  "Angry",
  "Brutal",
  "Dramatic",
  "Gritty",
  "Psychological",
  "Erotic",
  "Noir",
  "Gothic",
  "Documentary",
  "Epic",
  "Intimate",
  "Absurd",
  "Alienated",
  "Apocalyptic",
  "Controlled",
  "Cool",
  "Decadent",
  "Existential",
  "Hallucinatory",
  "Meditative",
  "Obsessive",
  "Provocative",
  "Rebellious",
  "Tragicomic",
  "Transcendent",
  "Traumatic",
  "Unhinged",
]);

/** 4 terms. */
export type ProjectState =
  | "draft"
  | "valid"
  | "warning"
  | "invalid";
export const PROJECT_STATE_VALUES: readonly ProjectState[] = Object.freeze([
  "draft",
  "valid",
  "warning",
  "invalid",
]);

/** 2 terms. */
export type ProjectType =
  | "live_action"
  | "animation";
export const PROJECT_TYPE_VALUES: readonly ProjectType[] = Object.freeze([
  "live_action",
  "animation",
]);

/** 3 terms. */
export type RuleSeverity =
  | "hard"
  | "warning"
  | "info";
export const RULE_SEVERITY_VALUES: readonly RuleSeverity[] = Object.freeze([
  "hard",
  "warning",
  "info",
]);

/** 12 terms. */
export type ShotSize =
  | "EWS"
  | "WS"
  | "MWS"
  | "MS"
  | "MCU"
  | "CU"
  | "BCU"
  | "ECU"
  | "OTS"
  | "POV"
  | "American"
  | "Italian";
export const SHOT_SIZE_VALUES: readonly ShotSize[] = Object.freeze([
  "EWS",
  "WS",
  "MWS",
  "MS",
  "MCU",
  "CU",
  "BCU",
  "ECU",
  "OTS",
  "POV",
  "American",
  "Italian",
]);

// --------------------------------------------------------------------------
// live_action
// --------------------------------------------------------------------------

/** 11 terms. */
export type AspectRatio =
  | "1.33:1"
  | "1.37:1"
  | "1.66:1"
  | "1.78:1"
  | "1.85:1"
  | "2.20:1"
  | "2.35:1"
  | "2.39:1"
  | "2.76:1"
  | "1.43:1"
  | "1.90:1";
export const ASPECT_RATIO_VALUES: readonly AspectRatio[] = Object.freeze([
  "1.33:1",
  "1.37:1",
  "1.66:1",
  "1.78:1",
  "1.85:1",
  "2.20:1",
  "2.35:1",
  "2.39:1",
  "2.76:1",
  "1.43:1",
  "1.90:1",
]);

/** 52 terms. */
export type CameraBody =
  | "Alexa_35"
  | "Alexa_Mini"
  | "Alexa_Mini_LF"
  | "Alexa_LF"
  | "Alexa_65"
  | "V_Raptor"
  | "V_Raptor_X"
  | "V_Raptor_XL"
  | "Komodo_X"
  | "Monstro_8K"
  | "Venice_2"
  | "FX9"
  | "FX6"
  | "C700_FF"
  | "C500_Mark_II"
  | "C300_Mark_III"
  | "Ursa_Mini_Pro_12K"
  | "Pocket_6K"
  | "Varicam_LT"
  | "S1H"
  | "Z9"
  | "Inspire_3"
  | "Mavic_3_Cine"
  | "Arricam_ST"
  | "Arricam_LT"
  | "ARRI_535B"
  | "ARRI_35BL"
  | "ARRI_35_III"
  | "Arriflex_35"
  | "Arriflex_35BL"
  | "Arriflex_435"
  | "Eclair_NPR"
  | "Panavision_Millennium_XL2"
  | "Panavision_Millennium"
  | "Panavision_Platinum"
  | "Panavision_Gold"
  | "Panavision_Panastar"
  | "Panavision_Panaflex"
  | "Super_Panavision_70"
  | "Ultra_Panavision_70"
  | "Panavision_XL"
  | "Alexa"
  | "Alexa_XT"
  | "RED_One"
  | "UFA_Custom"
  | "Pathe_Studio"
  | "Mitchell_BNC"
  | "Mitchell_BNCR"
  | "Mitchell_BFC_65"
  | "IMAX_MSM_9802"
  | "IMAX_MKIV"
  | "IMAX_GT";
export const CAMERA_BODY_VALUES: readonly CameraBody[] = Object.freeze([
  "Alexa_35",
  "Alexa_Mini",
  "Alexa_Mini_LF",
  "Alexa_LF",
  "Alexa_65",
  "V_Raptor",
  "V_Raptor_X",
  "V_Raptor_XL",
  "Komodo_X",
  "Monstro_8K",
  "Venice_2",
  "FX9",
  "FX6",
  "C700_FF",
  "C500_Mark_II",
  "C300_Mark_III",
  "Ursa_Mini_Pro_12K",
  "Pocket_6K",
  "Varicam_LT",
  "S1H",
  "Z9",
  "Inspire_3",
  "Mavic_3_Cine",
  "Arricam_ST",
  "Arricam_LT",
  "ARRI_535B",
  "ARRI_35BL",
  "ARRI_35_III",
  "Arriflex_35",
  "Arriflex_35BL",
  "Arriflex_435",
  "Eclair_NPR",
  "Panavision_Millennium_XL2",
  "Panavision_Millennium",
  "Panavision_Platinum",
  "Panavision_Gold",
  "Panavision_Panastar",
  "Panavision_Panaflex",
  "Super_Panavision_70",
  "Ultra_Panavision_70",
  "Panavision_XL",
  "Alexa",
  "Alexa_XT",
  "RED_One",
  "UFA_Custom",
  "Pathe_Studio",
  "Mitchell_BNC",
  "Mitchell_BNCR",
  "Mitchell_BFC_65",
  "IMAX_MSM_9802",
  "IMAX_MKIV",
  "IMAX_GT",
]);

/** 14 terms. */
export type CameraManufacturer =
  | "ARRI"
  | "RED"
  | "Sony"
  | "Canon"
  | "Blackmagic"
  | "Panasonic"
  | "Nikon"
  | "DJI"
  | "ARRI_Film"
  | "Panavision"
  | "Mitchell"
  | "IMAX"
  | "Eclair"
  | "Vintage";
export const CAMERA_MANUFACTURER_VALUES: readonly CameraManufacturer[] = Object.freeze([
  "ARRI",
  "RED",
  "Sony",
  "Canon",
  "Blackmagic",
  "Panasonic",
  "Nikon",
  "DJI",
  "ARRI_Film",
  "Panavision",
  "Mitchell",
  "IMAX",
  "Eclair",
  "Vintage",
]);

/** 2 terms. */
export type CameraType =
  | "Digital"
  | "Film";
export const CAMERA_TYPE_VALUES: readonly CameraType[] = Object.freeze([
  "Digital",
  "Film",
]);

/** 28 terms. */
export type FilmStock =
  | "Kodak_Vision3_500T_5219"
  | "Kodak_Vision3_250D_5207"
  | "Kodak_Vision3_200T_5213"
  | "Kodak_Vision3_50D_5203"
  | "Kodak_Vision2_500T_5218"
  | "Kodak_Vision2_200T_5217"
  | "Kodak_Vision_500T_5279"
  | "Kodak_Vision_320T_5277"
  | "Kodak_Double_X_5222"
  | "Kodak_Tri_X"
  | "Eastman_Double_X"
  | "Eastman_Plus_X"
  | "Eastman_5247"
  | "Eastman_5293"
  | "Eastman_5294"
  | "Eastman_5250"
  | "Eastman_5254"
  | "Technicolor"
  | "Kodachrome"
  | "Fuji_Eterna_500T"
  | "Fuji_Eterna_250D"
  | "Fuji_Eterna_250T"
  | "Kodak_65mm_500T"
  | "Kodak_65mm_250D"
  | "Kodak_65mm_200T"
  | "IMAX_500T"
  | "IMAX_250D"
  | "None";
export const FILM_STOCK_VALUES: readonly FilmStock[] = Object.freeze([
  "Kodak_Vision3_500T_5219",
  "Kodak_Vision3_250D_5207",
  "Kodak_Vision3_200T_5213",
  "Kodak_Vision3_50D_5203",
  "Kodak_Vision2_500T_5218",
  "Kodak_Vision2_200T_5217",
  "Kodak_Vision_500T_5279",
  "Kodak_Vision_320T_5277",
  "Kodak_Double_X_5222",
  "Kodak_Tri_X",
  "Eastman_Double_X",
  "Eastman_Plus_X",
  "Eastman_5247",
  "Eastman_5293",
  "Eastman_5294",
  "Eastman_5250",
  "Eastman_5254",
  "Technicolor",
  "Kodachrome",
  "Fuji_Eterna_500T",
  "Fuji_Eterna_250D",
  "Fuji_Eterna_250T",
  "Kodak_65mm_500T",
  "Kodak_65mm_250D",
  "Kodak_65mm_200T",
  "IMAX_500T",
  "IMAX_250D",
  "None",
]);

/** 47 terms. */
export type LensFamily =
  | "ARRI_Signature_Prime"
  | "ARRI_Master_Prime"
  | "ARRI_Ultra_Prime"
  | "ARRI_Prime_65"
  | "ARRI_Prime_DNA"
  | "Zeiss_Supreme_Prime"
  | "Zeiss_Master_Prime"
  | "Zeiss_CP3"
  | "Zeiss_Super_Speed"
  | "Zeiss_Standard_Speed"
  | "Zeiss_Ultra_Prime"
  | "Zeiss_Planar"
  | "Cooke_S7"
  | "Cooke_S4"
  | "Cooke_Anamorphic"
  | "Cooke_Panchro"
  | "Cooke_Speed_Panchro"
  | "Panavision_Primo"
  | "Panavision_Primo_70"
  | "Panavision_Anamorphic"
  | "Panavision_C_Series"
  | "Panavision_E_Series"
  | "Panavision_Sphero"
  | "Panavision_Ultra_Speed"
  | "Leica_Summilux"
  | "Leica_Summicron"
  | "Leica_Thalia"
  | "Canon_Sumire"
  | "Canon_CN_E"
  | "Canon_K35"
  | "Sony_CineAlta"
  | "Sigma_Cine"
  | "Sigma_High_Speed"
  | "Angenieux_Optimo"
  | "Angenieux_EZ"
  | "Angenieux_HR"
  | "Bausch_Lomb_Super_Baltar"
  | "Bausch_Lomb_Baltar"
  | "Zeiss_Planar_f0.7"
  | "Todd_AO"
  | "Hawk_V_Lite"
  | "Hawk_V_Plus"
  | "Hasselblad_HC"
  | "Hasselblad_V"
  | "IMAX_Optics"
  | "Vintage_Anamorphic"
  | "Vintage_Spherical";
export const LENS_FAMILY_VALUES: readonly LensFamily[] = Object.freeze([
  "ARRI_Signature_Prime",
  "ARRI_Master_Prime",
  "ARRI_Ultra_Prime",
  "ARRI_Prime_65",
  "ARRI_Prime_DNA",
  "Zeiss_Supreme_Prime",
  "Zeiss_Master_Prime",
  "Zeiss_CP3",
  "Zeiss_Super_Speed",
  "Zeiss_Standard_Speed",
  "Zeiss_Ultra_Prime",
  "Zeiss_Planar",
  "Cooke_S7",
  "Cooke_S4",
  "Cooke_Anamorphic",
  "Cooke_Panchro",
  "Cooke_Speed_Panchro",
  "Panavision_Primo",
  "Panavision_Primo_70",
  "Panavision_Anamorphic",
  "Panavision_C_Series",
  "Panavision_E_Series",
  "Panavision_Sphero",
  "Panavision_Ultra_Speed",
  "Leica_Summilux",
  "Leica_Summicron",
  "Leica_Thalia",
  "Canon_Sumire",
  "Canon_CN_E",
  "Canon_K35",
  "Sony_CineAlta",
  "Sigma_Cine",
  "Sigma_High_Speed",
  "Angenieux_Optimo",
  "Angenieux_EZ",
  "Angenieux_HR",
  "Bausch_Lomb_Super_Baltar",
  "Bausch_Lomb_Baltar",
  "Zeiss_Planar_f0.7",
  "Todd_AO",
  "Hawk_V_Lite",
  "Hawk_V_Plus",
  "Hasselblad_HC",
  "Hasselblad_V",
  "IMAX_Optics",
  "Vintage_Anamorphic",
  "Vintage_Spherical",
]);

/** 20 terms. */
export type LensManufacturer =
  | "ARRI"
  | "Zeiss"
  | "Cooke"
  | "Panavision"
  | "Leica"
  | "Canon"
  | "Sigma"
  | "Angenieux"
  | "Sony"
  | "Fujifilm"
  | "Hawk"
  | "Hasselblad"
  | "Technovision"
  | "Bausch_Lomb"
  | "Todd_AO"
  | "Kowa"
  | "Vintage"
  | "Warner_Bros"
  | "Paramount"
  | "Pathe";
export const LENS_MANUFACTURER_VALUES: readonly LensManufacturer[] = Object.freeze([
  "ARRI",
  "Zeiss",
  "Cooke",
  "Panavision",
  "Leica",
  "Canon",
  "Sigma",
  "Angenieux",
  "Sony",
  "Fujifilm",
  "Hawk",
  "Hasselblad",
  "Technovision",
  "Bausch_Lomb",
  "Todd_AO",
  "Kowa",
  "Vintage",
  "Warner_Bros",
  "Paramount",
  "Pathe",
]);

/** 6 terms. */
export type LensMountType =
  | "PL"
  | "LPL"
  | "XPL"
  | "Panavision"
  | "Mitchell_BNC"
  | "IMAX";
export const LENS_MOUNT_TYPE_VALUES: readonly LensMountType[] = Object.freeze([
  "PL",
  "LPL",
  "XPL",
  "Panavision",
  "Mitchell_BNC",
  "IMAX",
]);

/** 26 terms. */
export type LightingSource =
  | "Sun"
  | "Moon"
  | "Overcast"
  | "Window"
  | "Skylight"
  | "Tungsten"
  | "HMI"
  | "LED"
  | "Kino_Flo"
  | "Neon"
  | "Fluorescent"
  | "Artificial"
  | "Carbon_Arc"
  | "Mercury_Vapor"
  | "Sodium_Vapor"
  | "Practical"
  | "Practical_Lights"
  | "Candle"
  | "Candlelight"
  | "Firelight"
  | "Television"
  | "Computer_Screen"
  | "Christmas_Lights"
  | "Mixed"
  | "Available"
  | "Available_Light";
export const LIGHTING_SOURCE_VALUES: readonly LightingSource[] = Object.freeze([
  "Sun",
  "Moon",
  "Overcast",
  "Window",
  "Skylight",
  "Tungsten",
  "HMI",
  "LED",
  "Kino_Flo",
  "Neon",
  "Fluorescent",
  "Artificial",
  "Carbon_Arc",
  "Mercury_Vapor",
  "Sodium_Vapor",
  "Practical",
  "Practical_Lights",
  "Candle",
  "Candlelight",
  "Firelight",
  "Television",
  "Computer_Screen",
  "Christmas_Lights",
  "Mixed",
  "Available",
  "Available_Light",
]);

/** 20 terms. */
export type LightingStyle =
  | "High_Key"
  | "Low_Key"
  | "Soft"
  | "Soft_Lighting"
  | "Hard"
  | "Hard_Lighting"
  | "Naturalistic"
  | "Expressionistic"
  | "Chiaroscuro"
  | "Rembrandt"
  | "Split"
  | "Rim"
  | "Silhouette"
  | "Motivated"
  | "Practical_Motivated"
  | "Available_Light"
  | "High_Contrast"
  | "Controlled"
  | "Flat"
  | "Dramatic";
export const LIGHTING_STYLE_VALUES: readonly LightingStyle[] = Object.freeze([
  "High_Key",
  "Low_Key",
  "Soft",
  "Soft_Lighting",
  "Hard",
  "Hard_Lighting",
  "Naturalistic",
  "Expressionistic",
  "Chiaroscuro",
  "Rembrandt",
  "Split",
  "Rim",
  "Silhouette",
  "Motivated",
  "Practical_Motivated",
  "Available_Light",
  "High_Contrast",
  "Controlled",
  "Flat",
  "Dramatic",
]);

/** 16 terms. */
export type MovementEquipment =
  | "Static"
  | "Handheld"
  | "Shoulder_Rig"
  | "Steadicam"
  | "Gimbal"
  | "Dolly"
  | "Dolly_Track"
  | "Slider"
  | "Crane"
  | "Jib"
  | "Technocrane"
  | "Motion_Control"
  | "Drone"
  | "Cable_Cam"
  | "Car_Mount"
  | "SnorriCam";
export const MOVEMENT_EQUIPMENT_VALUES: readonly MovementEquipment[] = Object.freeze([
  "Static",
  "Handheld",
  "Shoulder_Rig",
  "Steadicam",
  "Gimbal",
  "Dolly",
  "Dolly_Track",
  "Slider",
  "Crane",
  "Jib",
  "Technocrane",
  "Motion_Control",
  "Drone",
  "Cable_Cam",
  "Car_Mount",
  "SnorriCam",
]);

/** 6 terms. */
export type MovementTiming =
  | "Static"
  | "Very_Slow"
  | "Slow"
  | "Moderate"
  | "Fast"
  | "Whip_Fast";
export const MOVEMENT_TIMING_VALUES: readonly MovementTiming[] = Object.freeze([
  "Static",
  "Very_Slow",
  "Slow",
  "Moderate",
  "Fast",
  "Whip_Fast",
]);

/** 29 terms. */
export type MovementType =
  | "Static"
  | "Pan"
  | "Tilt"
  | "Pan_Tilt"
  | "Track_In"
  | "Track_Out"
  | "Push_In"
  | "Pull_Back"
  | "Truck_Left"
  | "Truck_Right"
  | "Crab"
  | "Arc"
  | "Crane_Up"
  | "Crane_Down"
  | "Boom_Up"
  | "Boom_Down"
  | "Dolly_Zoom"
  | "Push_Pull"
  | "Zoom_In"
  | "Zoom_Out"
  | "Crash_Zoom"
  | "Roll"
  | "Whip_Pan"
  | "Whip_Tilt"
  | "Follow"
  | "Lead"
  | "Orbit"
  | "Reveal"
  | "Fly_Through";
export const MOVEMENT_TYPE_VALUES: readonly MovementType[] = Object.freeze([
  "Static",
  "Pan",
  "Tilt",
  "Pan_Tilt",
  "Track_In",
  "Track_Out",
  "Push_In",
  "Pull_Back",
  "Truck_Left",
  "Truck_Right",
  "Crab",
  "Arc",
  "Crane_Up",
  "Crane_Down",
  "Boom_Up",
  "Boom_Down",
  "Dolly_Zoom",
  "Push_Pull",
  "Zoom_In",
  "Zoom_Out",
  "Crash_Zoom",
  "Roll",
  "Whip_Pan",
  "Whip_Tilt",
  "Follow",
  "Lead",
  "Orbit",
  "Reveal",
  "Fly_Through",
]);

/** 10 terms. */
export type SensorSize =
  | "Super35"
  | "FullFrame"
  | "LargeFormat"
  | "65mm"
  | "MicroFourThirds"
  | "Film_35mm"
  | "Film_65mm"
  | "Film_70mm"
  | "IMAX_15_70"
  | "IMAX_GT";
export const SENSOR_SIZE_VALUES: readonly SensorSize[] = Object.freeze([
  "Super35",
  "FullFrame",
  "LargeFormat",
  "65mm",
  "MicroFourThirds",
  "Film_35mm",
  "Film_65mm",
  "Film_70mm",
  "IMAX_15_70",
  "IMAX_GT",
]);

/** 9 terms. */
export type TimeOfDay =
  | "Dawn"
  | "Morning"
  | "Midday"
  | "Afternoon"
  | "Golden_Hour"
  | "Blue_Hour"
  | "Dusk"
  | "Night"
  | "Magic_Hour";
export const TIME_OF_DAY_VALUES: readonly TimeOfDay[] = Object.freeze([
  "Dawn",
  "Morning",
  "Midday",
  "Afternoon",
  "Golden_Hour",
  "Blue_Hour",
  "Dusk",
  "Night",
  "Magic_Hour",
]);

/** 4 terms. */
export type WeightClass =
  | "UltraLight"
  | "Light"
  | "Medium"
  | "Heavy";
export const WEIGHT_CLASS_VALUES: readonly WeightClass[] = Object.freeze([
  "UltraLight",
  "Light",
  "Medium",
  "Heavy",
]);

// --------------------------------------------------------------------------
// Reflection
// --------------------------------------------------------------------------

/**
 * Every vocabulary by name, for the UI that has to render a picker for a field
 * it only knows by string. Values are the same frozen arrays declared above, so
 * this costs a map, not a second copy of 573 strings.
 */
export const CINEMA_VOCABULARIES: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    AnimationMedium: ANIMATION_MEDIUM_VALUES,
    AnimePreset: ANIME_PRESET_VALUES,
    AspectRatio: ASPECT_RATIO_VALUES,
    CameraBody: CAMERA_BODY_VALUES,
    CameraManufacturer: CAMERA_MANUFACTURER_VALUES,
    CameraType: CAMERA_TYPE_VALUES,
    ColorApplication: COLOR_APPLICATION_VALUES,
    ColorTone: COLOR_TONE_VALUES,
    Composition: COMPOSITION_VALUES,
    FilmStock: FILM_STOCK_VALUES,
    IllustrationPreset: ILLUSTRATION_PRESET_VALUES,
    LensFamily: LENS_FAMILY_VALUES,
    LensManufacturer: LENS_MANUFACTURER_VALUES,
    LensMountType: LENS_MOUNT_TYPE_VALUES,
    LightingModel: LIGHTING_MODEL_VALUES,
    LightingSource: LIGHTING_SOURCE_VALUES,
    LightingStyle: LIGHTING_STYLE_VALUES,
    LineTreatment: LINE_TREATMENT_VALUES,
    MangaPreset: MANGA_PRESET_VALUES,
    Mood: MOOD_VALUES,
    MotionStyle: MOTION_STYLE_VALUES,
    MovementEquipment: MOVEMENT_EQUIPMENT_VALUES,
    MovementTiming: MOVEMENT_TIMING_VALUES,
    MovementType: MOVEMENT_TYPE_VALUES,
    ProjectState: PROJECT_STATE_VALUES,
    ProjectType: PROJECT_TYPE_VALUES,
    RuleSeverity: RULE_SEVERITY_VALUES,
    SensorSize: SENSOR_SIZE_VALUES,
    ShotSize: SHOT_SIZE_VALUES,
    StyleDomain: STYLE_DOMAIN_VALUES,
    SurfaceDetail: SURFACE_DETAIL_VALUES,
    ThreeDPreset: THREE_DPRESET_VALUES,
    TimeOfDay: TIME_OF_DAY_VALUES,
    VirtualCamera: VIRTUAL_CAMERA_VALUES,
    WeightClass: WEIGHT_CLASS_VALUES,
  });
