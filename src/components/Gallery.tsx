'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ProjectWithImages } from '@/lib/types'

interface GalleryProps {
  projects: ProjectWithImages[]
}

export default function Gallery({ projects }: GalleryProps) {
  const categories = ['All', ...Array.from(new Set(projects.map(p => p.category).filter(Boolean)))]
  const [activeCategory, setActiveCategory] = useState('All')

  const filteredProjects = activeCategory === 'All'
    ? projects
    : projects.filter(p => p.category === activeCategory)

  return (
    <div>
      {/* Category Filter */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-4 mb-12 border-b border-black/10 pb-6">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category || 'All')}
              className={`text-sm uppercase tracking-wider transition-opacity ${
                activeCategory === category
                  ? 'text-black'
                  : 'text-neutral-400 hover:text-black'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-black/10">
        {filteredProjects.map((project, index) => (
          <Link
            key={project.id}
            href={`/project/${project.id}`}
            className="group bg-white"
          >
            <div className="aspect-[4/3] bg-neutral-100 img-zoom">
              {project.images && project.images.length > 0 ? (
                <img
                  src={project.images[0].url}
                  alt={project.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-300">
                  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-black/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight group-hover:opacity-50 transition-opacity">
                    {project.title}
                  </h2>
                  {project.category && (
                    <p className="text-sm text-neutral-500 mt-1 uppercase tracking-wider">
                      {project.category}
                    </p>
                  )}
                </div>
                <span className="text-sm text-neutral-400 tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div className="py-32 text-center border border-black/10">
          <p className="text-neutral-500 uppercase tracking-wider text-sm">No projects in this category</p>
        </div>
      )}
    </div>
  )
}
