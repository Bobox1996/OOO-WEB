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

/** Title font — Montserrat (web font) as primary for cross-device consistency,
 *  with ITC Avant Garde Gothic / Century Gothic fallbacks and sans-serif. */
export const FONT_TITLE = `var(--font-montserrat), "ITC Avant Garde Gothic", "Avant Garde Gothic", "Century Gothic", "Futura", sans-serif`;

/** O-field monospace font — Montserrat (web font) as primary for the "O" character,
 *  with CJK monospace fallbacks for uniform character width in the O grid. */
export const FONT_CJK_MONO = `var(--font-montserrat), "ITC Avant Garde Gothic", "Avant Garde Gothic", "Century Gothic", "Sarasa Mono SC", "Sarasa Mono", "等距更纱黑体 SC", "Source Han Mono SC", "Source Han Mono CN", "思源等宽", "Noto Sans Mono CJK SC", "HYZhengYuan", "STHeiti", "Microsoft YaHei Mono", "SimHei", monospace`;

/** Body font — system UI stack. */
export const FONT_BODY = `-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif`;

// ---------------------------------------------------------------------------
// Tailwind-compatible class names (mirrors the utility classes in globals.css)
// ---------------------------------------------------------------------------

export const fontClass = {
  title: "font-title",
  cjkMono: "font-cjk-mono",
} as const;
