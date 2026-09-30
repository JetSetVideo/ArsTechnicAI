/**
 * cinema_mappings.ts — GENERATED. Do not edit.
 *
 * Source: library/cinema/mappings.json
 * Regenerate: deno task codegen
 *
 * How a preset's hand-written terms map onto the closed vocabulary, and which
 * manufacturer each camera body belongs to. Without these, applying a film
 * preset silently keeps the defaults for every field it cannot resolve.
 */

/** body -> manufacturer (52). */
export const CAMERA_MANUFACTURER_BY_BODY: Readonly<Record<string, string>> = Object.freeze({
  "ARRI_35BL": "ARRI_Film",
  "ARRI_35_III": "ARRI_Film",
  "ARRI_535B": "ARRI_Film",
  "Alexa": "ARRI",
  "Alexa_35": "ARRI",
  "Alexa_65": "ARRI",
  "Alexa_LF": "ARRI",
  "Alexa_Mini": "ARRI",
  "Alexa_Mini_LF": "ARRI",
  "Alexa_XT": "ARRI",
  "Arricam_LT": "ARRI_Film",
  "Arricam_ST": "ARRI_Film",
  "Arriflex_35": "ARRI_Film",
  "Arriflex_35BL": "ARRI_Film",
  "Arriflex_435": "ARRI_Film",
  "C300_Mark_III": "Canon",
  "C500_Mark_II": "Canon",
  "C700_FF": "Canon",
  "Eclair_NPR": "Eclair",
  "FX6": "Sony",
  "FX9": "Sony",
  "IMAX_GT": "IMAX",
  "IMAX_MKIV": "IMAX",
  "IMAX_MSM_9802": "IMAX",
  "Inspire_3": "DJI",
  "Komodo_X": "RED",
  "Mavic_3_Cine": "DJI",
  "Mitchell_BFC_65": "Mitchell",
  "Mitchell_BNC": "Mitchell",
  "Mitchell_BNCR": "Mitchell",
  "Monstro_8K": "RED",
  "Panavision_Gold": "Panavision",
  "Panavision_Millennium": "Panavision",
  "Panavision_Millennium_XL2": "Panavision",
  "Panavision_Panaflex": "Panavision",
  "Panavision_Panastar": "Panavision",
  "Panavision_Platinum": "Panavision",
  "Panavision_XL": "Panavision",
  "Pathe_Studio": "Vintage",
  "Pocket_6K": "Blackmagic",
  "RED_One": "RED",
  "S1H": "Panasonic",
  "Super_Panavision_70": "Panavision",
  "UFA_Custom": "Vintage",
  "Ultra_Panavision_70": "Panavision",
  "Ursa_Mini_Pro_12K": "Blackmagic",
  "V_Raptor": "RED",
  "V_Raptor_X": "RED",
  "V_Raptor_XL": "RED",
  "Varicam_LT": "Panasonic",
  "Venice_2": "Sony",
  "Z9": "Nikon",
});

/** studio name -> lens maker (8). */
export const LENS_MANUFACTURER_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  "Bausch_Lomb": "Bausch_Lomb",
  "Kowa": "Kowa",
  "MGM": "Vintage",
  "Paramount": "Vintage",
  "Technicolor": "Vintage",
  "Todd_AO": "Todd_AO",
  "Universal": "Vintage",
  "Warner_Bros": "Vintage",
});

/** loose family name -> family (2). */
export const LENS_FAMILY_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  "Vintage_Anamorphic": "Vintage_Anamorphic",
  "Vintage_Spherical": "Vintage_Spherical",
});

/** spelled-out shot size -> code (20). */
export const SHOT_SIZE_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  "Big Close Up": "BCU",
  "Big_Close_Up": "BCU",
  "Close Up": "CU",
  "Close_Up": "CU",
  "Cowboy_Shot": "American",
  "Extreme Close Up": "ECU",
  "Extreme Wide Shot": "EWS",
  "Extreme_Close_Up": "ECU",
  "Extreme_Wide_Shot": "EWS",
  "Medium Close Up": "MCU",
  "Medium Shot": "MS",
  "Medium Wide Shot": "MWS",
  "Medium_Close_Up": "MCU",
  "Medium_Shot": "MS",
  "Medium_Wide_Shot": "MWS",
  "Over The Shoulder": "OTS",
  "Over_The_Shoulder": "OTS",
  "Point_of_View": "POV",
  "Wide Shot": "WS",
  "Wide_Shot": "WS",
});

/** spaced name -> identifier (5). */
export const COMPOSITION_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  "Frame Within Frame": "Frame_Within_Frame",
  "Golden Ratio": "Golden_Ratio",
  "Leading Lines": "Leading_Lines",
  "Negative Space": "Negative_Space",
  "Rule of Thirds": "Rule_of_Thirds",
});

/** short name -> full tone (6). */
export const COLOR_TONE_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  "Cool": "Cool_Saturated",
  "Highly_Saturated": "Warm_Saturated",
  "Muted": "Neutral_Desaturated",
  "Neutral": "Neutral_Saturated",
  "Teal Orange": "Teal_Orange",
  "Warm": "Warm_Saturated",
});

/** preset domain -> StyleDomain (9). */
export const STYLE_DOMAIN_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  "3D": "ThreeD",
  "Anime": "Anime",
  "Concept_Art": "Concept_Art",
  "Graphic_Novel": "Graphic_Novel",
  "Illustration": "Illustration",
  "Manga": "Manga",
  "Painterly": "Painterly",
  "ThreeD": "ThreeD",
  "Western_Animation": "Western_Animation",
});

/** preset medium -> medium (4). */
export const ANIMATION_MEDIUM_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  "2D": "2D",
  "3D": "3D",
  "Hybrid": "Hybrid",
  "StopMotion": "StopMotion",
});

/**
 * Movement aliases, each naming *which* field it sets.
 *
 * A preset's single `movement` string may be equipment (`Slow_Dolly` -> Dolly),
 * a movement type (`Slow_Push_In` -> Push_In) or a timing (`Slow` -> Slow), and
 * writing one into the wrong field is invisible until a rule fails to fire.
 */
export type MovementField = "equipment" | "movementType" | "timing";
export const MOVEMENT_ALIASES: Readonly<
  Record<string, { readonly field: MovementField; readonly value: string }>
> = Object.freeze({
  "Controlled": { field: "equipment", value: "Static" },
  "Controlled_Dolly": { field: "equipment", value: "Dolly" },
  "Extended_Handheld": { field: "equipment", value: "Handheld" },
  "Extended_Tracking": { field: "movementType", value: "Track_In" },
  "Fast_Montage": { field: "timing", value: "Fast" },
  "Fast_Tracking": { field: "movementType", value: "Track_In" },
  "Floating": { field: "equipment", value: "Static" },
  "Floating_Handheld": { field: "equipment", value: "Handheld" },
  "Gentle_Dolly": { field: "equipment", value: "Dolly" },
  "IMAX_Crane": { field: "equipment", value: "Crane" },
  "Kinetic": { field: "movementType", value: "Track_In" },
  "Locked_Off": { field: "equipment", value: "Static" },
  "Mechanical": { field: "equipment", value: "Motion_Control" },
  "Mechanical_Dolly": { field: "equipment", value: "Dolly" },
  "Minimal": { field: "equipment", value: "Static" },
  "Minimal_Dolly": { field: "equipment", value: "Dolly" },
  "Observational": { field: "equipment", value: "Static" },
  "Rigid": { field: "equipment", value: "Static" },
  "Slow": { field: "timing", value: "Slow" },
  "Slow_Crane": { field: "equipment", value: "Crane" },
  "Slow_Creep": { field: "movementType", value: "Track_In" },
  "Slow_Dolly": { field: "equipment", value: "Dolly" },
  "Slow_Handheld": { field: "equipment", value: "Handheld" },
  "Slow_Pan": { field: "movementType", value: "Pan" },
  "Slow_Push_In": { field: "movementType", value: "Push_In" },
  "Slow_Tracking": { field: "movementType", value: "Track_In" },
  "Slow_Zoom": { field: "movementType", value: "Zoom_In" },
  "Tracking": { field: "movementType", value: "Track_In" },
  "Unpredictable": { field: "equipment", value: "Handheld" },
  "Unsettling_Static": { field: "equipment", value: "Static" },
});
