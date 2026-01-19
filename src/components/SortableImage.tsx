'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Image, Project } from '@/lib/types'

interface SortableImageProps {
  image: Image
  index: number
  project: Project
  onSetCover: (imageId: string) => void
  onDelete: (imageId: string) => void
  settingCover: boolean
}

export default function SortableImage({
  image,
  index,
  project,
  onSetCover,
  onDelete,
  settingCover,
}: SortableImageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group bg-white border border-black/10 ${
        isDragging ? 'shadow-2xl ring-2 ring-black' : ''
      }`}
    >
      {/* Draggable area - the image itself */}
      <div
        {...attributes}
        {...listeners}
        className="aspect-square cursor-grab active:cursor-grabbing"
      >
        <img
          src={image.url}
          alt={image.filename}
          className="w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
      </div>

      {/* Image number badge */}
      <div className="absolute top-2 left-2 w-6 h-6 bg-black text-white text-xs flex items-center justify-center pointer-events-none">
        {index + 1}
      </div>

      {/* Drag indicator */}
      <div className="absolute top-2 left-10 px-2 py-1 bg-black/70 text-white text-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM14 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM14 20a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM20 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM18 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM20 20a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
        </svg>
        Drag
      </div>

      {/* Cover badge */}
      {project.cover_image_id === image.id && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-blue-600 text-white text-xs uppercase tracking-wider pointer-events-none">
          Cover
        </div>
      )}

      {/* Controls overlay - only buttons, not the whole area */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        {/* Set as Cover */}
        {project.cover_image_id !== image.id && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSetCover(image.id)
            }}
            disabled={settingCover}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs uppercase tracking-wider hover:bg-blue-700 transition-colors disabled:opacity-50"
            title="Set as cover image"
          >
            Set as Cover
          </button>
        )}

        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(image.id)
          }}
          className="p-2 bg-white text-black hover:bg-red-500 hover:text-white transition-colors"
          title="Delete image"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}
