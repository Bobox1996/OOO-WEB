import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ProjectPageClient from '@/components/ProjectPageClient'
import SiteHeader from '@/components/SiteHeader'
import type { Metadata } from 'next'
import type { Project, Image as ImageType } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

// Generate dynamic metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: project } = await supabase
    .from('projects')
    .select('title, description, category')
    .eq('id', id)
    .single()
  
  if (!project) {
    return { title: 'Project Not Found | OOO' }
  }
  
  return {
    title: `${project.title} | OOO`,
    description: project.description || `${project.category || 'Architecture and Design'} project by OOO`,
  }
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch project with images in a single query
  const { data: projectData } = await supabase
    .from('projects')
    .select('*, images(*)')
    .eq('id', id)
    .single()

  if (!projectData) {
    notFound()
  }

  const project = projectData as Project & { images: ImageType[] }
  
  // Sort images by sort_order
  const images = (project.images || []).sort((a, b) => a.sort_order - b.sort_order)

  // Separate first image (hero) from remaining images
  const remainingImages = images.slice(1)

  // Group images for side-by-side display
  type ImageGroup = { type: 'single'; image: ImageType; originalIndex: number } | { type: 'pair'; images: [ImageType, ImageType]; originalIndices: [number, number] }
  
  const imageGroups: ImageGroup[] = []
  let i = 0
  while (i < remainingImages.length) {
    const current = remainingImages[i]
    const next = remainingImages[i + 1]
    
    // Check if current and next both have side_by_side enabled
    if (next && current.side_by_side && next.side_by_side) {
      imageGroups.push({
        type: 'pair',
        images: [current, next],
        originalIndices: [i + 1, i + 2] // +1 because hero is index 0
      })
      i += 2 // Skip both images
    } else {
      imageGroups.push({
        type: 'single',
        image: current,
        originalIndex: i + 1 // +1 because hero is index 0
      })
      i += 1
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader variant="floating" />

      {/* Client component handles hero, gallery, and lightbox */}
      <ProjectPageClient project={project} images={images} imageGroups={imageGroups}>
        {/* Description Section - passed as children to render between hero and gallery */}
        {project.description && (
          <section className="border-b border-black/10">
            <div className="max-w-screen-2xl mx-auto px-6 md:px-12 py-16 md:py-24">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-16">
                {/* Left Column - Meta */}
                <div className="md:col-span-2">
                  <div className="space-y-6">
                    {project.category && (
                      <div>
                        <p className="text-xs uppercase tracking-widest text-neutral-400 mb-1">Category</p>
                        <p className="text-sm uppercase tracking-wider">{project.category}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs uppercase tracking-widest text-neutral-400 mb-1">Date</p>
                      <p className="text-sm">
                        {new Date(project.created_at).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long'
                        })}
                      </p>
                    </div>
                    {project.team && (
                      <div>
                        <p className="text-xs uppercase tracking-widest text-neutral-400 mb-1">Team</p>
                        <p className="text-sm">{project.team}</p>
                      </div>
                    )}
                  </div>
                </div>
                {/* Right Column - Description */}
                <div className="md:col-span-10">
                  <p className="text-sm whitespace-pre-wrap">
                    {project.description}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </ProjectPageClient>

      {/* No Images State */}
      {images.length === 0 && (
        <section className="py-32 text-center border-b border-black/10">
          <p className="text-neutral-500 uppercase tracking-wider text-sm">No images</p>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-black/10 px-6 py-8">
        <div className="max-w-screen-2xl mx-auto flex flex-col items-center gap-4 md:flex-row md:justify-between md:gap-0">
          <p className="text-sm text-neutral-500">
            © {new Date().getFullYear()} OOO
          </p>
          <div className="flex flex-col items-center gap-2 md:flex-row md:gap-8">
            <a 
              href="mailto:office@out-of-office.design" 
              className="text-sm text-neutral-500 hover:opacity-50 transition-opacity"
            >
              office@out-of-office.design
            </a>
            <Link href="/" className="text-sm uppercase tracking-wider hover:opacity-50 transition-opacity">
              All Works
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
