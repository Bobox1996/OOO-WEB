// Shared utilities for O-field grid components (VisionOField, TeamOField)

/**
 * Throttle helper - limits function calls to once per `delay` ms.
 * Trailing call is guaranteed if a call arrives during the cooldown.
 */
export function throttle<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T {
  let lastCall = 0
  let timeoutId: NodeJS.Timeout | null = null

  return ((...args: Parameters<T>) => {
    const now = Date.now()
    const elapsed = now - lastCall

    if (elapsed >= delay) {
      lastCall = now
      fn(...args)
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now()
        timeoutId = null
        fn(...args)
      }, delay - elapsed)
    }
  }) as T
}

/** Detect CJK Unified Ideographs (U+4E00–U+9FFF) */
export function isCJKCharacter(char: string): boolean {
  const code = char.charCodeAt(0)
  return code >= 0x4E00 && code <= 0x9FFF
}

/** Compute visual width of text (CJK = 2 cells, others = 1 cell) */
export function visualWidth(text: string): number {
  let w = 0
  for (const ch of text) w += isCJKCharacter(ch) ? 2 : 1
  return w
}

/**
 * Place a line of text into a grid, calling `setter` for each cell.
 *
 * The setter receives (row, col, char, span) and should write the cell.
 * CJK characters get span=2 and produce a secondary (span=0) cell.
 *
 * Returns `{ startCol, totalSpan }` describing the placement region.
 */
export function placeText(
  setter: (row: number, col: number, char: string, span: number) => void,
  row: number,
  text: string,
  cols: number,
  align: 'center' | 'left' = 'center',
  offset: number = 0
): { startCol: number; totalSpan: number } {
  const totalSpan = visualWidth(text)
  let startCol = align === 'center'
    ? Math.max(0, Math.floor((cols - totalSpan) / 2))
    : 0
  startCol = Math.max(0, Math.min(cols - totalSpan, startCol + offset))

  let col = startCol
  for (const ch of text) {
    if (col >= cols) break
    const span = isCJKCharacter(ch) ? 2 : 1
    setter(row, col, ch, span)
    if (span === 2 && col + 1 < cols) {
      setter(row, col + 1, '', 0)
    }
    col += span
  }

  return { startCol, totalSpan }
}
