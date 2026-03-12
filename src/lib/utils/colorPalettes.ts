export interface SavedPalette {
  id: string
  name: string
  colors: string[]
}

const STORAGE_KEY = 'savedColorPalettes'

export function getSavedPalettes(): SavedPalette[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

export function savePalette(name: string, colors: string[]): SavedPalette {
  const palettes = getSavedPalettes()
  const palette: SavedPalette = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    colors,
  }
  palettes.push(palette)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(palettes))
  window.dispatchEvent(new Event('palettes-updated'))
  return palette
}

export function deletePalette(id: string): void {
  const palettes = getSavedPalettes().filter((p) => p.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(palettes))
  window.dispatchEvent(new Event('palettes-updated'))
}
