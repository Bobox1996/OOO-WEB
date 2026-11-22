import Link from 'next/link'
import SiteHeader from '@/components/layout/SiteHeader'
import StudioLogo from '@/components/layout/StudioLogo'
import './portfolio.css'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="portfolio">
    <SiteHeader />
    {children}
    <footer className="site-foot">
      <Link href="/" aria-label="Out Of Office Design home"><StudioLogo variant="lockup" className="studio-foot-logo" /></Link>
      <a href="mailto:office@out-of-office.design">office@out-of-office.design ↗</a>
      <nav aria-label="Studio tools"><Link href="/app/login">App</Link><Link href="/admin/login">Admin</Link></nav>
    </footer>
  </div>
}
