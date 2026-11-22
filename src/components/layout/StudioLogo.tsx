import Image from 'next/image'
import lockup from '@/assets/brand/out-of-office-lockup.png'
import mark from '@/assets/brand/out-of-office-mark.png'

export default function StudioLogo({ variant = 'mark', className = 'block h-8 w-auto' }: {
  variant?: 'mark' | 'lockup'
  className?: string
}) {
  return <Image src={variant === 'lockup' ? lockup : mark} alt="" className={className} unoptimized />
}
