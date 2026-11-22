import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { zipSync } from 'fflate'
import { experimentDirectory } from '@/lib/experiments'

export const dynamic = 'force-static'

// Package only the starter's distributable source.
const files = [
  'page.tsx', 'study.module.css', 'ooo.ts', 'experiment.json', 'package.json', 'package-lock.json',
  'README.md', 'AGENTS.md', '.gitignore', '_preview/next.config.mjs',
  '_preview/tsconfig.json', '_preview/app/layout.tsx', '_preview/app/page.tsx',
]

export async function GET() {
  const root = path.join(process.cwd(), experimentDirectory, 'grid-study')
  const entries = await Promise.all(files.map(async name => [
    `ooo-experiment-template/${name}`, await readFile(path.join(root, name)),
  ] as const))
  const archive = zipSync(Object.fromEntries(entries))
  return new Response(new Uint8Array(archive), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="ooo-experiment-template.zip"',
    },
  })
}
