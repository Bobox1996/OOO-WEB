import Link from 'next/link'
import { experimentDirectory, experimentSource, listExperiments } from '@/lib/experiments'
import styles from './lab.module.css'

export const metadata = { title: 'Experiments · Out Of Office' }
export const dynamic = 'force-static'

export default async function ExperimentsPage() {
  const experiments = await listExperiments()

  return (
    <section className={styles.lab}>
      <header className={styles.header}>
        <div>
          <h1>Experiments</h1>
          <p>Small apps built by Out Of Office members.</p>
        </div>
        <a className={styles.download} href="/admin/app/template" download="ooo-experiment-template.zip">
          Download template <span aria-hidden="true">↓</span>
        </a>
      </header>

      {experiments.length ? (
        <ul className={styles.list} aria-label="Studio experiments">
          {experiments.map(app => (
            <li key={app.slug}>
              <Link className={styles.entry} href={`/admin/app/experiments/${app.slug}`}>
                <strong>{app.title}</strong>
                <span>{app.description}</span>
                <small>{app.author} · v{app.version}</small>
              </Link>
              <a className={styles.source} href={`${experimentSource}/${app.slug}`} target="_blank" rel="noreferrer"
                aria-label={`View ${app.title} source on GitHub`}>GitHub ↗</a>
            </li>
          ))}
        </ul>
      ) : <p className={styles.empty}>Download the template to publish the first studio experiment.</p>}

      <details className={styles.guide}>
        <summary>How to publish an experiment</summary>
        <ol>
          <li>Unzip the template. Run <code>npm ci</code> and <code>npm run dev</code> in its folder, then open the local URL.</li>
          <li>Build your app in <code>page.tsx</code>. Update its title, author, description and version in <code>experiment.json</code>, then run <code>npm run build</code>.</li>
          <li>Copy the app files into a new folder under <a href={experimentSource}>the website’s experiments directory</a> (<code>{experimentDirectory}/your-app</code>). The template README lists the files to copy.</li>
          <li>Commit to <code>Bobox1996/OOO-WEB</code> and push to <code>main</code>. When Vercel finishes publishing, the app appears here.</li>
        </ol>
      </details>
      <footer className={styles.footer}><Link href="/admin/app/users">App settings →</Link></footer>
    </section>
  )
}
