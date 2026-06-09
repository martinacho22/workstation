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

const STATUS_LABEL: Record<ProjectMeta['status'], string> = {
  active:  'Active',
  blocked: 'Blocked',
  done:    'Done',
  idle:    'Idle',
}

const STATUS_DOT: Record<ProjectMeta['status'], string> = {
  active:  '●',
  blocked: '▲',
  done:    '✓',
  idle:    '○',
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
  onWarRoom: () => void
}

export default function Dashboard({ onOpenCanvas, onNewProject, onWarRoom }: Props) {
  const { getProjectMetas, switchProject, deleteProject } = useWorkstationStore()
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const metas = getProjectMetas()
  const filtered = metas.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  )

  const totalProjects  = metas.length
  const activeProjects = metas.filter(p => p.status === 'active').length
  const totalBugs      = metas.reduce((a, p) => a + p.openBugs, 0)
  const totalTangents  = metas.reduce((a, p) => a + p.openTangents, 0)

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
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Your projects, at a glance.</p>
        </div>
        <button className={styles.newBtn} onClick={onNewProject}>+ New Project</button>
      </div>

      {/* Stats Row */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{totalProjects}</span>
          <span className={styles.statLabel}>Projects</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue} style={{ color: 'var(--accent)' }}>{activeProjects}</span>
          <span className={styles.statLabel}>Active</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue} style={{ color: '#f87171' }}>{totalBugs}</span>
          <span className={styles.statLabel}>Open Bugs</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue} style={{ color: '#f0c040' }}>{totalTangents}</span>
          <span className={styles.statLabel}>Open Tangents</span>
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchRow}>
        <input
          className={styles.search}
          placeholder="Search projects..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Empty state */}
      {metas.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>No projects yet</div>
          <div className={styles.emptyDesc}>Create your first project to get started.</div>
          <button className={styles.newBtn} onClick={onNewProject}>+ New Project</button>
        </div>
      )}

      {/* Project Cards */}
      {metas.length > 0 && (
        <div className={styles.grid}>
          {filtered.map(project => (
            <div key={project.id} className={styles.card}>
              {/* Card Header */}
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.cardName}>{project.name}</div>
                  <div className={styles.cardDesc}>{project.description}</div>
                </div>
                <span className={styles.status} style={{ color: STATUS_COLOR[project.status] }}>
                  {STATUS_DOT[project.status]} {STATUS_LABEL[project.status]}
                </span>
              </div>

              {/* Progress */}
              <div className={styles.progressRow}>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
                <span className={styles.progressLabel}>{project.progress}%</span>
              </div>

              {/* Meta */}
              <div className={styles.cardMeta}>
                <span>{project.stack}</span>
                {project.deployTarget && project.deployTarget !== 'none' && (
                  <span>Deploy: {project.deployTarget}</span>
                )}
                <span>Last active: {timeAgo(project.lastActive)}</span>
              </div>

              {/* Chips */}
              <div className={styles.chips}>
                <span className={styles.chip}>
                  {project.sectionsDone}/{project.sectionsTotal} sections
                </span>
                {project.openBugs > 0 && (
                  <span className={`${styles.chip} ${styles.chipRed}`}>
                    {project.openBugs} {project.openBugs === 1 ? 'bug' : 'bugs'}
                  </span>
                )}
                {project.openTangents > 0 && (
                  <span className={`${styles.chip} ${styles.chipYellow}`}>
                    {project.openTangents} {project.openTangents === 1 ? 'tangent' : 'tangents'}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className={styles.cardActions}>
                <button
                  className={styles.openBtn}
                  onClick={() => handleOpen(project.id)}
                >
                  Open Canvas
                </button>
                <button className={styles.warBtn} onClick={() => {
                  switchProject(project.id)
                  onWarRoom()
                }}>
                  War Room
                </button>
                {confirmDelete === project.id ? (
                  <button
                    className={styles.deleteConfirmBtn}
                    onClick={() => handleDelete(project.id)}
                  >
                    Confirm Delete
                  </button>
                ) : (
                  <button
                    className={styles.deleteBtn}
                    onClick={() => setConfirmDelete(project.id)}
                    title="Delete project"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* New Project Card */}
          <div className={`${styles.card} ${styles.newCard}`} onClick={onNewProject}>
            <div className={styles.newCardInner}>
              <span className={styles.newCardIcon}>+</span>
              <span className={styles.newCardLabel}>New Project</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
