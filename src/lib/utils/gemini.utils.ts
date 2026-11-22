const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com'

export function buildGeminiUrl(model: string, apiKey: string): string {
  const baseUrl = (process.env.GEMINI_API_BASE_URL || DEFAULT_GEMINI_BASE_URL).replace(/\/$/, '')
  return `${baseUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`
}

export function toGeminiFetchError(error: unknown): string {
  if (error instanceof TypeError && error.message === 'fetch failed') {
    const cause = (error as { cause?: { code?: string } }).cause
    if (cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
      return 'Cannot connect to Gemini API (connection timed out). Enable a VPN or set HTTPS_PROXY in .env.local if Google services are blocked in your region.'
    }
    return 'Cannot connect to Gemini API. Check your internet connection or VPN.'
  }

  return error instanceof Error ? error.message : 'Failed to reach Gemini API'
}
