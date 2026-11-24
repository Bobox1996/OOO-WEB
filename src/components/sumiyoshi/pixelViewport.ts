/** The world uses a fixed artwork resolution. The projected TV document and HUD use CSS pixels. */
export function pixelViewport(width: number, height: number, desktopWidth: 480 | 640) {
  const portrait = width / height < 0.87
  const scale = Math.min(1, portrait ? 320 / width : desktopWidth / width,
    portrait ? 520 / height : (desktopWidth * 9 / 16) / height)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}
