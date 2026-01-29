import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const { prompt } = await request.json()
    
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    // Check for Gemini API key
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    // Call Gemini API for image generation (gemini-2.0-flash-exp-image-generation)
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      }
    )

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json().catch(() => ({}))
      console.error('Gemini API error:', errorData)
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to generate image' },
        { status: geminiResponse.status }
      )
    }

    const geminiData = await geminiResponse.json()
    
    // Extract base64 image from response
    // The response structure: candidates[0].content.parts[] - find the part with inlineData
    const parts = geminiData.candidates?.[0]?.content?.parts || []
    const imagePart = parts.find((part: { inlineData?: { mimeType: string; data: string } }) => part.inlineData?.mimeType?.startsWith('image/'))
    const imageBase64 = imagePart?.inlineData?.data
    
    if (!imageBase64) {
      console.error('No image in response:', JSON.stringify(geminiData, null, 2))
      return NextResponse.json({ error: 'No image generated' }, { status: 500 })
    }

    // Convert base64 to blob
    const imageBuffer = Buffer.from(imageBase64, 'base64')
    const fileName = `${user.id}/${Date.now()}.png`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('generations')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to save image' }, { status: 500 })
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('generations')
      .getPublicUrl(fileName)

    const imageUrl = urlData.publicUrl

    // Save to database
    const { data: generation, error: dbError } = await supabase
      .from('app_generations')
      .insert({
        user_id: user.id,
        prompt: prompt,
        image_url: imageUrl,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json({ error: 'Failed to save generation record' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      generation: {
        id: generation.id,
        prompt: generation.prompt,
        image_url: generation.image_url,
        created_at: generation.created_at,
      },
    })
  } catch (error) {
    console.error('Generate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
