/**
 * One colour per idea, used by every figure, formula and prose pill in the
 * lesson. The four quantity hues are the four symbols the lesson turns on:
 *
 *   p  =  m  ×  v        E_k = ½ m v²
 *  teal  amber indigo    violet
 *
 * p   — momentum, the quantity a crash carries through untouched
 * m   — mass, the stack of blocks on a trolley bed
 * v   — velocity, the arrow on a trolley
 * E_k — kinetic energy, the quantity only a springy crash keeps
 */

export const MOMENTUM = "#62D0AD";
export const MOMENTUM_TEXT = "#1F9E78";
export const MOMENTUM_BG = "rgba(98, 208, 173, 0.22)";

export const MASS = "#F7B23B";
export const MASS_TEXT = "#C27803";
export const MASS_BG = "rgba(247, 178, 59, 0.22)";
export const MASS_FILL = "rgba(247, 178, 59, 0.32)";

export const VELOCITY = "#8E90F5";
export const VELOCITY_TEXT = "#5B5FD9";
export const VELOCITY_BG = "rgba(142, 144, 245, 0.22)";

export const ENERGY = "#AC8BF9";
export const ENERGY_TEXT = "#7C4DDB";
export const ENERGY_BG = "rgba(172, 139, 249, 0.22)";

/**
 * The two trolleys get hues of their own, used for nothing else, so "the heavy
 * trolley" never reads as "momentum": sky blue for the heavy one, rose for the
 * light one. Bodies are a pale tint, edges and labels the deeper shade.
 */
export const HEAVY = "#62CCF9";
export const HEAVY_EDGE = "#1E8FC2";
export const HEAVY_FILL = "rgba(98, 204, 249, 0.30)";
export const HEAVY_BG = "rgba(98, 204, 249, 0.22)";

export const LIGHT = "#F8A0CD";
export const LIGHT_EDGE = "#C4508F";
export const LIGHT_FILL = "rgba(248, 160, 205, 0.32)";
export const LIGHT_BG = "rgba(248, 160, 205, 0.22)";

/** The student's own prediction — the faint pair they slide before pressing play. */
export const GUESS = "#F4A89A";
export const GUESS_TEXT = "#C9614C";

/** Student answers and definitions — deliberately none of the quantity or trolley hues. */
export const ANSWER = "#2563EB";
export const ANSWER_BG = "rgba(37, 99, 235, 0.12)";

export const INK = "#334155";
export const INK_STRUCTURE = "#64748B";
export const INK_QUIET = "#CBD5E1";
export const PAPER = "#F1F5F9";

/** Keys for `\clr{...}` in every formula. None of these is a variable name or a highlight id. */
export const FORMULA_COLORS = {
    p: MOMENTUM_TEXT,
    m: MASS_TEXT,
    v: VELOCITY_TEXT,
    e: ENERGY_TEXT,
    heavy: HEAVY_EDGE,
    light: LIGHT_EDGE,
} as const;

export const EASE_150 = {
    transition: "opacity 150ms ease, stroke-width 150ms ease, fill-opacity 150ms ease",
} as const;

export const HANDLE_SHADOW = {
    dx: 0,
    dy: 1,
    stdDeviation: 1.5,
    floodColor: "#0F172A",
    floodOpacity: 0.25,
} as const;
