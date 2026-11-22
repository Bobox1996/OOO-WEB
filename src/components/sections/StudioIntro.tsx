export default function StudioIntro({ title, count, content }: {
  title: string
  count?: number
  content?: string | null
}) {
  const paragraphs = content?.trim().split(/\n\s*\n/)
  return <header className="studio-spread studio-intro">
    <h1>{title}{count !== undefined && <sup>({String(count).padStart(2, '0')})</sup>}</h1>
    {paragraphs?.[0] && <div className="studio-copy">
      {paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
    </div>}
  </header>
}
