import { useState } from 'react'
import styles from './Projects.module.css'

type Tab = 'import' | 'templates' | 'saved'

const TEMPLATES = [
  { id: 't1', name: 'Next.js SaaS Starter',  desc: 'Auth, billing, dashboard, deploy to Vercel',         stack: 'Next.js + Supabase + Stripe',    sections: 7 },
  { id: 't2', name: 'REST API',               desc: 'Express API with auth, DB, and Railway deploy',       stack: 'Node.js + Postgres + Railway',   sections: 5 },
  { id: 't3', name: 'React Native App',       desc: 'Mobile app with Expo + backend',                     stack: 'Expo + FastAPI + Supabase',       sections: 6 },
  { id: 't4', name: 'Electron Desktop App',   desc: 'Desktop tool with local storage and auto-update',    stack: 'Electron + React + SQLite',       sections: 5 },
  { id: 't5', name: 'Python CLI Tool',        desc: 'Packaged CLI with tests and PyPI publish',           stack: 'Python + Click + pytest',         sections: 4 },
  { id: 't6', name: 'Blank Canvas',           desc: 'Start from scratch — you define the sections',       stack: 'Your choice',                     sections: 0 },
]

interface Props {
  onLoadTemplate: (templateId: string) => void
  onImport: (path: string) => void
}

export default function Projects({ onLoadTemplate, onImport }: Props) {
  const [tab, setTab] = useState<Tab>('templates')
  const [importPath, setImportPath] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)

  async function handleImport() {
    if (!importPath.trim()) return
    setImporting(true)
    setImportResult(null)
    // In real Electron: window.electronAPI.analyzeProject(importPath)
    setTimeout(() => {
      setImporting(false)
      setImportResult('Project analyzed — 6 sections detected. Ready to load into canvas.')
      onImport(importPath)
    }, 2000)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Projects</h1>
        <p className={styles.subtitle}>Start fresh, import existing, or use a template.</p>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'templates' ? styles.activeTab : ''}`} onClick={() => setTab('templates')}>
          Templates
        </button>
        <button className={`${styles.tab} ${tab === 'import' ? styles.activeTab : ''}`} onClick={() => setTab('import')}>
          Import Existing
        </button>
        <button className={`${styles.tab} ${tab === 'saved' ? styles.activeTab : ''}`} onClick={() => setTab('saved')}>
          Saved Templates
        </button>
      </div>

      {/* Templates */}
      {tab === 'templates' && (
        <div className={styles.grid}>
          {TEMPLATES.map(t => (
            <div key={t.id} className={styles.card}>
              <div className={styles.cardName}>{t.name}</div>
              <div className={styles.cardDesc}>{t.desc}</div>
              <div className={styles.cardMeta}>
                <span>{t.stack}</span>
                {t.sections > 0 && <span>{t.sections} sections</span>}
              </div>
              <button className={styles.useBtn} onClick={() => onLoadTemplate(t.id)}>
                Use Template →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Import */}
      {tab === 'import' && (
        <div className={styles.importPanel}>
          <div className={styles.importTitle}>Import an existing project</div>
          <div className={styles.importDesc}>
            Point Workstation at a local folder. Claude will scan the codebase, detect your stack,
            and auto-generate sections based on what's already built. You'll pick up right where you left off.
          </div>

          <div className={styles.importRow}>
            <input
              className={styles.importInput}
              placeholder="/Users/you/projects/my-app"
              value={importPath}
              onChange={e => setImportPath(e.target.value)}
            />
            <button
              className={styles.browseBtn}
              onClick={() => {
                // In real Electron: window.electronAPI.openFolderDialog().then(setImportPath)
                setImportPath('/Users/you/projects/my-app')
              }}
            >
              Browse
            </button>
          </div>

          {importPath && (
            <button
              className={styles.importBtn}
              onClick={handleImport}
              disabled={importing}
            >
              {importing ? 'Analyzing project...' : 'Analyze & Import →'}
            </button>
          )}

          {importResult && (
            <div className={styles.importResult}>{importResult}</div>
          )}

          <div className={styles.importHow}>
            <div className={styles.importHowTitle}>What happens during import:</div>
            <ol className={styles.importSteps}>
              <li>Workstation reads your <code>package.json</code>, <code>requirements.txt</code>, <code>Cargo.toml</code>, etc.</li>
              <li>Claude analyzes the folder structure and existing code</li>
              <li>Sections are auto-generated based on what's already built — marked "In Progress"</li>
              <li>A handoff doc is created per section summarizing what exists</li>
              <li>The canvas pre-populates — you're back in context immediately</li>
            </ol>
          </div>
        </div>
      )}

      {/* Saved */}
      {tab === 'saved' && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>[ ]</div>
          <div className={styles.emptyTitle}>No saved templates yet</div>
          <div className={styles.emptyDesc}>
            Finish a project and save its canvas structure as a template — reuse it for future projects.
          </div>
        </div>
      )}
    </div>
  )
}
