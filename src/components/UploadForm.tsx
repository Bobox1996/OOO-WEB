'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// 直接使用桶名，避免环境变量问题
const BUCKET_NAME = 'drawings'

interface UploadFormProps {
  projectId?: string
}

export default function UploadForm({ projectId }: UploadFormProps) {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
      setError(null)
      setSuccess(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith('image/')
    )
    setFiles(droppedFiles)
    setError(null)
    setSuccess(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const uploadFiles = async () => {
    if (!projectId || files.length === 0) {
      setError('Please select a project and files to upload')
      return
    }

    setUploading(true)
    setError(null)
    setProgress(0)

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileExt = file.name.split('.').pop()
        const fileName = `${projectId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(fileName, file)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(fileName)

        const { error: dbError } = await supabase
          .from('images')
          .insert({
            project_id: projectId,
            url: publicUrl,
            filename: file.name,
          })

        if (dbError) throw dbError

        setProgress(((i + 1) / files.length) * 100)
      }

      setSuccess(true)
      setFiles([])
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-black/20 p-12 text-center cursor-pointer hover:border-black transition-colors"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-4">
          <svg className="w-12 h-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <div>
            <p className="font-medium">Drop images here or click to browse</p>
            <p className="text-sm text-neutral-500 mt-1">JPG, PNG, GIF, WebP</p>
          </div>
        </div>
      </div>

      {/* Selected Files */}
      {files.length > 0 && (
        <div>
          <p className="text-sm uppercase tracking-wider text-neutral-500 mb-4">
            {files.length} file(s) selected
          </p>
          <div className="grid grid-cols-4 gap-2">
            {files.map((file, index) => (
              <div key={index} className="aspect-square bg-neutral-100">
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress */}
      {uploading && (
        <div>
          <div className="h-1 bg-neutral-200">
            <div
              className="h-full bg-black transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-neutral-500 mt-2 text-center">
            Uploading... {Math.round(progress)}%
          </p>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="border border-black p-4 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="border border-black/30 p-4 text-sm text-neutral-600">
          Images uploaded successfully
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={uploadFiles}
        disabled={uploading || files.length === 0 || !projectId}
        className="w-full py-4 bg-black text-white text-sm uppercase tracking-widest font-medium hover:bg-neutral-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {uploading ? 'Uploading...' : 'Upload Images'}
      </button>
    </div>
  )
}
