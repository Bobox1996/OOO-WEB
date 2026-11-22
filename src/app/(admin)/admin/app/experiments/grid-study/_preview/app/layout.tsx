import type { ReactNode } from 'react'
import experiment from '../../experiment.json'

export const metadata = { title: `${experiment.title} · Out Of Office` }

export default function PreviewLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 'clamp(20px, 5vw, 64px)', fontFamily: 'Arial, sans-serif' }}>
        <header style={{ maxWidth: '60rem', margin: '0 auto 2rem', paddingBottom: '1rem', borderBottom: '1px solid #ddd' }}>
          Out Of Office / Experiments
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
