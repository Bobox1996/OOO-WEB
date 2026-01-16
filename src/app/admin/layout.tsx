import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin — OOO',
  description: 'Admin panel for portfolio management',
}

export default function AdminLayout({
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
