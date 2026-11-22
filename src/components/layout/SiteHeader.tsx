'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function SiteHeader({ onTeamClick }: { onTeamClick?: (e: React.MouseEvent) => void }) {
  const path = usePathname()
  return <header className="studio-head">
    <Link href="/" className="studio-brand" aria-label="Out Of Office Design home">
      <span aria-hidden="true" className="ooo-mark"><i /><i /><i /></span>
      <span>Out Of<br />Office Design</span>
    </Link>
    <nav aria-label="Main navigation">{[['/', 'Works'], ['/team', 'Team'], ['/vision', 'Vision']].map(([href, label]) =>
      <Link key={href} href={href} onClick={href === '/team' ? onTeamClick : undefined}
        aria-current={(href === '/' ? path === '/' || path.startsWith('/project/') : path === href) ? 'page' : undefined}>{label}</Link>
    )}</nav>
    <a className="head-contact" href="mailto:office@out-of-office.design">Contact <span>↗</span></a>
  </header>
}
