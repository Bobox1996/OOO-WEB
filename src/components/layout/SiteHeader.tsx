import Link from 'next/link'

interface SiteHeaderProps {
  variant?: 'default' | 'floating'
  onTeamClick?: (e: React.MouseEvent) => void
}

export default function SiteHeader({ variant = 'default', onTeamClick }: SiteHeaderProps) {
  if (variant === 'floating') {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="flex items-center justify-between px-6 py-5">
          <Link 
            href="/" 
            className="font-title text-2xl font-bold tracking-tight text-black pointer-events-auto hover:opacity-70 transition-opacity"
          >
            OOO
          </Link>
          <Link 
            href="/" 
            className="text-sm uppercase tracking-widest text-black pointer-events-auto hover:opacity-70 transition-opacity"
          >
            ← Back
          </Link>
        </div>
      </nav>
    )
  }

  // Default header
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-black/10">
      <div className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="font-title text-2xl font-bold tracking-tight">
          OOO
        </Link>
        <nav className="flex items-center gap-8">
          <Link href="/" className="text-sm uppercase tracking-widest hover:opacity-50 transition-opacity">
            Works
          </Link>
          {onTeamClick ? (
            <button 
              onClick={onTeamClick}
              className="text-sm uppercase tracking-widest hover:opacity-50 transition-opacity"
            >
              Team
            </button>
          ) : (
            <Link href="/team" className="text-sm uppercase tracking-widest hover:opacity-50 transition-opacity">
              Team
            </Link>
          )}
          <Link href="/vision" className="text-sm uppercase tracking-widest hover:opacity-50 transition-opacity">
            Vision
          </Link>
        </nav>
      </div>
    </header>
  )
}
