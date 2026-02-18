import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/services/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { image } = await request.json()

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'Image is required (base64)' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    // Fetch the prompt template from config
    const { data: config, error: configError } = await supabase
      .from('app_color_themer_config')
      .select('prompt_template')
      .limit(1)
      .single()

    if (configError || !config) {
      return NextResponse.json({ error: 'Color Themer config not found. Ask an admin to set up the prompt template.' }, { status: 500 })
    }

    let promptText: string
    try {
      const parsed = JSON.parse(config.prompt_template)
      promptText = parsed.instruction || config.prompt_template
    } catch {
      promptText = config.prompt_template
    }

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: image,
        },
      },
      { text: promptText },
    ]

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ['TEXT'],
        },
      }),
    })

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json().catch(() => ({}))
      console.error('Gemini API error:', errorData)
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to analyze image' },
        { status: 500 },
      )
    }

    const geminiData = await geminiResponse.json()
    const responseParts = geminiData.candidates?.[0]?.content?.parts || []
    const textPart = responseParts.find((part: { text?: string }) => part.text)
    const responseText = textPart?.text || ''

    // Try parsing as JSON array first
    let colors: string[] = []
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*?\]/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (Array.isArray(parsed)) {
          colors = parsed.filter((c: unknown) => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c))
        }
      }
    } catch {
      // Fall back to regex extraction
    }

    // Fallback: extract hex codes via regex
    if (colors.length === 0) {
      const hexMatches = responseText.match(/#[0-9A-Fa-f]{6}/g)
      if (hexMatches) {
        colors = [...new Set(hexMatches)]
      }
    }

    if (colors.length === 0) {
      console.error('No colors found in response:', responseText)
      return NextResponse.json(
        { error: 'Could not extract colors from the AI response. Try a different image.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, colors })
  } catch (error) {
    console.error('Color themer error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
