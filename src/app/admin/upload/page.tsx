'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminNav from '@/components/AdminNav'
import UploadForm from '@/components/UploadForm'
import type { Project } from '@/lib/types'

export default function UploadPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProject, setNewProject] = useState({ title: '', description: '', category: '' })
  const [creating, setCreating] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setProjects(data)
  }

  const createProject = async () => {
    if (!newProject.title.trim()) return
    setCreating(true)

    const { data, error } = await supabase
      .from('projects')
      .insert({
        title: newProject.title,
        description: newProject.description || null,
        category: newProject.category || null,
      })
      .select()
      .single()

    if (!error && data) {
      setProjects([data, ...projects])
      setSelectedProject(data.id)
      setNewProject({ title: '', description: '', category: '' })
      setShowNewProject(false)
    }
    setCreating(false)
  }

  return (
    <>
      <AdminNav />
      <main className="pt-24 px-6 pb-12">
        <div className="max-w-screen-md mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-[clamp(2rem,5vw,4rem)] font-bold leading-[0.95] tracking-tighter uppercase">
              Upload
            </h1>
            <p className="text-neutral-500 mt-4 text-lg">Add images to your portfolio</p>
          </div>

          {/* Project Selection */}
          <div className="border border-black/10 p-8 mb-8">
            <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-4">
              Select Project
            </label>
            <div className="flex gap-4">
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="flex-1 px-4 py-3 bg-white border border-black/20 text-black focus:outline-none focus:border-black"
              >
                <option value="">Choose a project...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowNewProject(!showNewProject)}
                className="px-6 py-3 border border-black text-black text-sm uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
              >
                + New
              </button>
            </div>
          </div>

          {/* New Project Form */}
          {showNewProject && (
            <div className="border border-black p-8 mb-8">
              <h3 className="text-lg font-semibold mb-6 uppercase tracking-wider">New Project</h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={newProject.title}
                    onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                    className="w-full px-0 py-3 bg-transparent border-0 border-b border-black text-black placeholder-neutral-400 focus:outline-none text-lg"
                    placeholder="Project title"
                  />
                </div>
                <div>
                  <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">
                    Category
                  </label>
                  <input
                    type="text"
                    value={newProject.category}
                    onChange={(e) => setNewProject({ ...newProject, category: e.target.value })}
                    className="w-full px-0 py-3 bg-transparent border-0 border-b border-black/30 text-black placeholder-neutral-400 focus:outline-none focus:border-black text-lg"
                    placeholder="e.g., Architecture, Photography"
                  />
                </div>
                <div>
                  <label className="block text-sm uppercase tracking-wider text-neutral-500 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    rows={3}
                    className="w-full px-0 py-3 bg-transparent border-0 border-b border-black/30 text-black placeholder-neutral-400 focus:outline-none focus:border-black text-lg resize-none"
                    placeholder="Brief description..."
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    onClick={createProject}
                    disabled={creating || !newProject.title.trim()}
                    className="px-6 py-3 bg-black text-white text-sm uppercase tracking-widest hover:bg-neutral-800 transition-colors disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    onClick={() => setShowNewProject(false)}
                    className="px-6 py-3 border border-black/30 text-neutral-500 text-sm uppercase tracking-widest hover:border-black hover:text-black transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Upload Form */}
          <div className="border border-black/10 p-8">
            <UploadForm projectId={selectedProject} />
          </div>
        </div>
      </main>
    </>
  )
}
