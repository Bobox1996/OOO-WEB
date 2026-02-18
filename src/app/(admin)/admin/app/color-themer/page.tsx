import { createClient } from '@/services/supabase/server'
import EditColorThemerConfigForm from '@/components/admin/EditColorThemerConfigForm'
import type { AppColorThemerConfig } from '@/types'

export default async function ColorThemerConfigPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('app_color_themer_config')
    .select('*')
    .limit(1)
    .single()

  const config = data as AppColorThemerConfig | null

  return (
    <>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight uppercase">
            Color Themer
          </h2>
          <p className="text-neutral-500 mt-2">
            Manage the JSON prompt template used by the Color Themer AI tool
          </p>
        </div>
      </div>

      <EditColorThemerConfigForm
        configId={config?.id ?? null}
        initialTemplate={config?.prompt_template ?? ''}
      />

      <div className="mt-8 p-6 border border-black/10 bg-neutral-50">
        <h3 className="font-medium mb-2">How it works</h3>
        <p className="text-sm text-neutral-500">
          The prompt template is sent to the Gemini AI along with the user&apos;s uploaded image.
          The AI analyzes the image and returns a color palette based on your prompt instructions.
          The template should be valid JSON containing an &quot;instruction&quot; field that tells the AI
          how to extract and format the colors.
        </p>
      </div>
    </>
  )
}
