import 'server-only'
import { access, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

export const experimentDirectory = 'src/app/(admin)/admin/app/experiments'
export const experimentSource = 'https://github.com/Bobox1996/OOO-WEB/tree/main/src/app/(admin)/admin/app/experiments'

type Experiment = {
  slug: string
  title: string
  author: string
  version: string
  description: string
}

export async function listExperiments(): Promise<Experiment[]> {
  const directory = path.join(process.cwd(), experimentDirectory)
  const folders = await readdir(directory, { withFileTypes: true })
  const apps = folders.filter(folder => folder.isDirectory() && !folder.name.startsWith('_'))
  const entries = await Promise.all(apps.map(async ({ name: slug }) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error(`Invalid experiment folder name: ${slug}`)
    }
    const metadata = JSON.parse(await readFile(path.join(directory, slug, 'experiment.json'), 'utf8'))
    for (const key of ['title', 'author', 'version', 'description']) {
      if (typeof metadata[key] !== 'string' || !metadata[key].trim()) {
        throw new Error(`Missing ${key} in ${slug}/experiment.json`)
      }
    }
    await access(path.join(directory, slug, 'page.tsx'))
    return { slug, title: metadata.title, author: metadata.author, version: metadata.version, description: metadata.description }
  }))
  return entries.sort((a, b) => a.title.localeCompare(b.title, 'en'))
}
