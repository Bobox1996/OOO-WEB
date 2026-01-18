interface FloatingTitleProps {
  children: React.ReactNode
  lines?: number  // Number of text lines (default: 1)
}

// Calculate the sticky top position
// Formula: position so only half of the last line shows when stuck
const getTopStyle = (lines: number): string => {
  const multiplier = lines - 0.5
  return `calc(60px - 3rem - clamp(3rem,10vw,8rem)*0.9*${multiplier})`
}

export default function FloatingTitle({ children, lines = 1 }: FloatingTitleProps) {
  const topValue = getTopStyle(lines)
  
  return (
    <>
      {/* Spacer for fixed header */}
      <div className="h-[60px]" />

      {/* Sticky floating title - no background, floats above content */}
      <section 
        className="sticky z-40 pt-12 pb-4 px-6 pointer-events-none"
        style={{ top: topValue }}
      >
        <div className="max-w-screen-2xl mx-auto">
          <h1 className="text-[clamp(3rem,10vw,8rem)] font-bold leading-[0.9] tracking-tighter uppercase">
            {children}
          </h1>
        </div>
      </section>
    </>
  )
}
