import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'APP — OOO',
  description: 'AI Image Generator',
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white">
      {children}
    </div>
  )
}
