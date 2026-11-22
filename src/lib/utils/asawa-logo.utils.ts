import { parseSvg } from '@/components/sections/LogoImport'
import type { AsawaLogoOverlay } from '@/components/sections/AsawaViewer'

export const ASAWA_DEFAULT_LOGO_URL = '/defaults/asawa-default.svg'

export async function loadAsawaLogoFromUrl(url: string): Promise<AsawaLogoOverlay | null> {
  try {
    const response = await fetch(url)
    const svgText = await response.text()
    const { innerContent, width, height, minX, minY, defaultFill, defaultStroke, defaultStrokeWidth } = parseSvg(svgText)
    if (!innerContent) return null
    return {
      svgContent: innerContent,
      fillColor: defaultFill,
      strokeColor: defaultStroke,
      strokeWidth: defaultStrokeWidth,
      nativeWidth: width,
      nativeHeight: height,
      nativeMinX: minX,
      nativeMinY: minY,
    }
  } catch (err) {
    console.error('Failed to load Asawa logo:', err)
    return null
  }
}

export function loadDefaultAsawaLogo(): Promise<AsawaLogoOverlay | null> {
  return loadAsawaLogoFromUrl(ASAWA_DEFAULT_LOGO_URL)
}
