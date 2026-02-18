import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/services/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { location, season, time, environment, keyElements } = await request.json()

    if (!location || !season || !time || !environment || !keyElements) {
      return NextResponse.json({ error: 'All scene parameters are required' }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

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
      if (!parsed.themeImagePrompt) {
        return NextResponse.json({ error: 'No themeImagePrompt found in config. Ask an admin to add it to the JSON template.' }, { status: 500 })
      }

      // First pass: substitute user inputs throughout the entire JSON
      let fullJson = JSON.stringify(parsed, null, 2)
        .replace(/\{location\}/g, location)
        .replace(/\{season\}/g, season)
        .replace(/\{time\}/g, time)
        .replace(/\{environment\}/g, environment)
        .replace(/\{keyElements\}/g, keyElements)

      // Second pass: resolve {themeImagePrompt} self-reference in prompt_layers.base
      const withInputs = JSON.parse(fullJson)
      if (withInputs.themeImagePrompt) {
        fullJson = fullJson.replace(/\{themeImagePrompt\}/g, withInputs.themeImagePrompt)
      }

      promptText = fullJson
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in prompt template config' }, { status: 500 })
    }

    const parts: Array<{ text: string }> = [{ text: promptText }]

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`
    const requestBody = JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    })

    const [geminiResponse1, geminiResponse2] = await Promise.all([
      fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      }),
      fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      }),
    ])

    const extractImage = async (response: Response, index: number) => {
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error(`Gemini API error (variation ${index}):`, errorData)
        throw new Error(errorData.error?.message || 'Failed to generate image')
      }

      const geminiData = await response.json()
      const responseParts = geminiData.candidates?.[0]?.content?.parts || []
      const imagePart = responseParts.find((part: { inlineData?: { mimeType: string; data: string } }) =>
        part.inlineData?.mimeType?.startsWith('image/')
      )
      const imageBase64 = imagePart?.inlineData?.data

      if (!imageBase64) {
        console.error(`No image in response (variation ${index}):`, JSON.stringify(geminiData, null, 2))
        throw new Error('No image generated')
      }

      return imageBase64
    }

    let image1: string
    let image2: string
    try {
      [image1, image2] = await Promise.all([
        extractImage(geminiResponse1, 1),
        extractImage(geminiResponse2, 2),
      ])
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate images' }, { status: 500 })
    }

    return NextResponse.json({ success: true, images: [image1, image2] })
  } catch (error) {
    console.error('Color themer generate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
