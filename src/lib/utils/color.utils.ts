/**
 * Color utility functions for extracting average color from images
 * and calculating contrasting text colors.
 */

export interface RGB {
  r: number
  g: number
  b: number
}

export interface HSL {
  h: number // 0-360
  s: number // 0-100
  l: number // 0-100
}

/**
 * Extracts the average color from an image using a small canvas for performance.
 * Uses a 10x10 canvas (100 pixels) which is sufficient for average color calculation.
 * 
 * @param img - The image element to sample
 * @returns RGB values of the average color, or null if extraction fails
 */
export function getAverageColor(img: HTMLImageElement): RGB | null {
  try {
    // Use a small canvas for fast sampling
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // Downsample to 10x10 for performance
    const sampleSize = 10
    canvas.width = sampleSize
    canvas.height = sampleSize

    // Draw scaled-down image
    ctx.drawImage(img, 0, 0, sampleSize, sampleSize)

    // Get pixel data
    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize)
    const data = imageData.data

    let r = 0, g = 0, b = 0
    const pixelCount = sampleSize * sampleSize

    // Sum all pixel values
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
      // Skip alpha channel (i + 3)
    }

    // Calculate average
    return {
      r: Math.round(r / pixelCount),
      g: Math.round(g / pixelCount),
      b: Math.round(b / pixelCount),
    }
  } catch {
    // Canvas operations can fail due to CORS or other issues
    return null
  }
}

/**
 * Convert RGB to HSL color space
 */
function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

/**
 * Convert HSL to hex color string
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100

  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0, g = 0, b = 0

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c
  } else {
    r = c; g = 0; b = x
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Calculates the complementary (contrasting) color by shifting hue 180 degrees
 * and adjusting lightness for visibility.
 * 
 * @param r - Red value (0-255)
 * @param g - Green value (0-255)
 * @param b - Blue value (0-255)
 * @returns Hex color string of the contrasting color
 */
export function getContrastColor(r: number, g: number, b: number): string {
  const hsl = rgbToHsl(r, g, b)
  
  // Shift hue by 180 degrees for complementary color
  const contrastHue = (hsl.h + 180) % 360
  
  // Adjust lightness for better visibility:
  // If original is dark, make contrast light; if original is light, make contrast dark
  // Also boost saturation for more vivid contrast
  let contrastLightness: number
  let contrastSaturation: number
  
  if (hsl.l < 50) {
    // Original is dark, make contrast lighter
    contrastLightness = Math.min(85, hsl.l + 50)
  } else {
    // Original is light, make contrast darker
    contrastLightness = Math.max(15, hsl.l - 50)
  }
  
  // Maximize saturation for vivid colors, but handle grayscale images
  if (hsl.s < 10) {
    // Near grayscale - use inverted lightness with no saturation
    contrastSaturation = 0
    contrastLightness = hsl.l > 50 ? 15 : 85
  } else {
    // Push saturation to maximum for vibrant contrasting colors
    contrastSaturation = 100
  }
  
  return hslToHex(contrastHue, contrastSaturation, contrastLightness)
}

/**
 * Convenience function that extracts average color and returns contrast color.
 * 
 * @param img - The image element to analyze
 * @returns Contrasting color hex string, or '#ffffff' as fallback
 */
export function getContrastColorForImage(img: HTMLImageElement): string {
  const avgColor = getAverageColor(img)
  if (!avgColor) return '#ffffff' // Default to white if extraction fails
  return getContrastColor(avgColor.r, avgColor.g, avgColor.b)
}
