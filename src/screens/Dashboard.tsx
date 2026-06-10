import { useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import { ProjectMeta } from '@/types'
import styles from './Dashboard.module.css'

const STATUS_COLOR: Record<ProjectMeta['status'], string> = {
  active:  'var(--accent)',
  blocked: '#f0c040',
  done:    '#4ade80',
  idle:    'rgba(255,255,255,0.2)',
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 2)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

interface Props {
  onOpenCanvas: (projectId: string) => void
  onNewProject: () => void
  onWarRoom:    () => void
}

export default function Dashboard({ onOpenCanvas, onNewProject, onWarRoom }: Props) {
  const { getProjectMetas, switchProject, deleteProject } = useWorkstationStore()
  const [search, setSearch]             = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const metas    = getProjectMetas()
  const filtered = metas.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  )

  const totalProjects  = metas.length
  const activeProjects = metas.filter(p => p.status === 'active').length
  const doneProjects   = metas.filter(p => p.status === 'done').length
  const totalBugs      = metas.reduce((a, p) => a + p.openBugs, 0)

  function handleOpen(id: string) {
    switchProject(id)
    onOpenCanvas(id)
  }

  function handleDelete(id: string) {
    deleteProject(id)
    setConfirmDelete(null)
  }

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Workstation</h1>
          <p className={styles.subtitle}>Your projects.</p>
        </div>
        <button className={styles.newBtn} onClick={onNewProject}>+ New project</button>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{totalProjects}</span>
          <span className={styles.statLabel}>Total</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue} style={{ color: 'var(--accent)' }}>{activeProjects}</span>
          <span className={styles.statLabel}>Active</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue} style={{ color: '#4ade80' }}>{doneProjects}</span>
          <span className={styles.statLabel}>Done</span>
        </div>
        {totalBugs > 0 && (
          <div className={styles.stat}>
            <span className={styles.statValue} style={{ color: '#f87171' }}>{totalBugs}</span>
            <span className={styles.statLabel}>Open bugs</span>
          </div>
        )}
      </div>

      {/* Search */}
      {metas.length > 0 && (
        <div className={styles.searchRow}>
          <input
            className={styles.search}
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* Empty state */}
      {metas.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>No projects yet</div>
          <div className={styles.emptyDesc}>
            Create a project to start building. Workstation will interview you about your idea,
            then generate a focused build plan.
          </div>
          <button className={styles.newBtn} onClick={onNewProject}>+ New project</button>
        </div>
      )}

      {/* Project Grid */}
      {metas.length > 0 && (
        <div className={styles.grid}>
          {filtered.map(p => (
            <div key={p.id} className={`${styles.card} ${styles[`card_${p.status}`]}`}>

              <div className={styles.cardTop}>
                <div className={styles.cardTitles}>
                  <div className={styles.cardName}>{p.name}</div>
                  <div className={styles.cardStack}>{p.stack}</div>
                </div>
                <div className={styles.cardStatus} style={{ color: STATUS_COLOR[p.status] }}>
                  {p.status}
                </div>
              </div>

              {p.description && (
                <div className={styles.cardDesc}>{p.description}</div>
              )}

              {/* Progress */}
              <div className={styles.cardProgress}>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${p.progress}%` }} />
                </div>
                <span className={styles.progressLabel}>
                  {p.sectionsDone}/{p.sectionsTotal} sections
                </span>
              </div>

              {/* Chips */}
              <div className={styles.chips}>
                {p.openBugs > 0 && (
                  <span className={styles.chipBug}>{p.openBugs} open bug{p.openBugs > 1 ? 's' : ''}</span>
                )}
                <span className={styles.chipMeta}>{timeAgo(p.lastActive)}</span>
              </div>

              {/* Actions */}
              <div className={styles.cardActions}>
                <button className={styles.openBtn} onClick={() => handleOpen(p.id)}>
                  Open
                </button>
                <button className={styles.warBtn} onClick={() => { switchProject(p.id); onWarRoom() }}>
                  War Room
                </button>
                {confirmDelete === p.id ? (
                  <button className={styles.deleteConfirmBtn} onClick={() => handleDelete(p.id)}>
                    Confirm delete
                  </button>
                ) : (
                  <button
                    className={styles.deleteBtn}
                    onClick={() => setConfirmDelete(p.id)}
                    title="Delete project"
                  >
                    ✕
                  </button>
                )}
              </div>

            </div>
          ))}

          {/* New card */}
          <div className={`${styles.card} ${styles.newCard}`} onClick={onNewProject}>
            <span className={styles.newIcon}>+</span>
            <span className={styles.newLabel}>New project</span>
          </div>
        </div>
      )}

    </div>
  )
}
