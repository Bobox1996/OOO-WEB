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
    const { prompt, patternImage, packageImage } = await request.json()
    
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    // Validate patternImage if provided
    if (patternImage && typeof patternImage !== 'string') {
      return NextResponse.json({ error: 'Invalid pattern image format' }, { status: 400 })
    }

    // Validate packageImage if provided
    if (packageImage && typeof packageImage !== 'string') {
      return NextResponse.json({ error: 'Invalid package image format' }, { status: 400 })
    }

    // Check for Gemini API key
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
    }

    // Build parts array for Gemini API
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []
    
    // Add pattern image as first part if provided (FIRST image in prompt)
    if (patternImage) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: patternImage,
        },
      })
    }
    
    // Add package image as second part if provided (SECOND image in prompt)
    if (packageImage) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: packageImage,
        },
      })
    }
    
    // Add text prompt
    parts.push({ text: prompt })

    // Gemini API URL
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`
    const requestBody = JSON.stringify({
      contents: [
        {
          parts,
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    })

    // Make 2 parallel API calls for variations
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

    // Helper function to extract image from Gemini response
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

    // Extract images from both responses
    let imageBase64_1: string
    let imageBase64_2: string
    try {
      [imageBase64_1, imageBase64_2] = await Promise.all([
        extractImage(geminiResponse1, 1),
        extractImage(geminiResponse2, 2),
      ])
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to generate images' }, { status: 500 })
    }

    // Upload both images to Supabase Storage
    const timestamp = Date.now()
    const fileName1 = `${user.id}/${timestamp}-1.png`
    const fileName2 = `${user.id}/${timestamp}-2.png`

    const [upload1, upload2] = await Promise.all([
      supabase.storage.from('generations').upload(fileName1, Buffer.from(imageBase64_1, 'base64'), {
        contentType: 'image/png',
        upsert: false,
      }),
      supabase.storage.from('generations').upload(fileName2, Buffer.from(imageBase64_2, 'base64'), {
        contentType: 'image/png',
        upsert: false,
      }),
    ])

    if (upload1.error || upload2.error) {
      console.error('Upload errors:', upload1.error, upload2.error)
      return NextResponse.json({ error: 'Failed to save images' }, { status: 500 })
    }

    // Get public URLs
    const imageUrl1 = supabase.storage.from('generations').getPublicUrl(fileName1).data.publicUrl
    const imageUrl2 = supabase.storage.from('generations').getPublicUrl(fileName2).data.publicUrl

    // Save both to database
    const { data: generations, error: dbError } = await supabase
      .from('app_generations')
      .insert([
        { user_id: user.id, prompt: prompt, image_url: imageUrl1 },
        { user_id: user.id, prompt: prompt, image_url: imageUrl2 },
      ])
      .select()

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json({ error: 'Failed to save generation records' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      generations: generations.map((gen) => ({
        id: gen.id,
        prompt: gen.prompt,
        image_url: gen.image_url,
        created_at: gen.created_at,
      })),
    })
  } catch (error) {
    console.error('Generate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
