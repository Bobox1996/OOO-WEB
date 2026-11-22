/**
 * Centralized font management
 *
 * This file is the single source of truth for all font stacks used across the
 * project. The corresponding CSS utility classes are defined in globals.css and
 * must be kept in sync with the values here.
 */

// ---------------------------------------------------------------------------
// Font stacks
// ---------------------------------------------------------------------------

/** Shared face used for interface titles and body copy. */
export const FONT_TITLE = "var(--studio-font)";

/** O-field monospace font — Montserrat (web font) as primary for the "O" character,
 *  with CJK monospace fallbacks for uniform character width in the O grid. */
export const FONT_CJK_MONO = `var(--font-montserrat), "ITC Avant Garde Gothic", "Avant Garde Gothic", "Century Gothic", "Sarasa Mono SC", "Sarasa Mono", "等距更纱黑体 SC", "Source Han Mono SC", "Source Han Mono CN", "思源等宽", "Noto Sans Mono CJK SC", "HYZhengYuan", "STHeiti", "Microsoft YaHei Mono", "SimHei", monospace`;

export const FONT_BODY = "var(--studio-font)";

// ---------------------------------------------------------------------------
// Tailwind-compatible class names (mirrors the utility classes in globals.css)
// ---------------------------------------------------------------------------

export const fontClass = {
  title: "font-title",
  cjkMono: "font-cjk-mono",
} as const;
