const artwork = {
  480: { portraitWidth: 320, portraitHeight: 520 },
  640: { portraitWidth: 320, portraitHeight: 520 },
  960: { portraitWidth: 432, portraitHeight: 864 },
} as const

export type ArtworkWidth = keyof typeof artwork

export function artworkWidth(setting: string | null): ArtworkWidth {
  if (setting === '480') return 480
  if (setting === '640') return 640
  return 960
}

/** Cap the 3D buffer in CSS pixels. The TV document and HUD render at the device resolution. */
export function pixelViewport(width: number, height: number, desktopWidth: ArtworkWidth = 960) {
  const portrait = width / height < 0.87
  const { portraitWidth, portraitHeight } = artwork[desktopWidth]
  const scale = Math.min(1, (portrait ? portraitWidth : desktopWidth) / width,
    (portrait ? portraitHeight : desktopWidth * 9 / 16) / height)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Enlarge each lounge texel by a whole number of CSS pixels on both axes. */
export function loungeViewport(width: number, height: number) {
  const portrait = width / height < 0.87
  const zoom = Math.max(1, Math.round(Math.max(
    width / (portrait ? 200 : 460), height / (portrait ? 400 : 290),
  )))
  return { width: Math.max(1, Math.round(width / zoom)), height: Math.max(1, Math.round(height / zoom)) }
}
