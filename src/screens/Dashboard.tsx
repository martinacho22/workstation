import { useState } from 'react'
import styles from './Dashboard.module.css'

interface Project {
  id: string
  name: string
  description: string
  stack: string
  progress: number
  sectionsTotal: number
  sectionsDone: number
  openBugs: number
  openTangents: number
  lastActive: string
  status: 'active' | 'blocked' | 'done' | 'idle'
  deployTarget?: string
}

const MOCK_PROJECTS: Project[] = [
  {
    id: '1',
    name: 'Workstation',
    description: 'Infinite canvas for developers using Claude',
    stack: 'Electron + React + TypeScript',
    progress: 60,
    sectionsTotal: 8,
    sectionsDone: 5,
    openBugs: 2,
    openTangents: 1,
    lastActive: '2 hours ago',
    status: 'active',
    deployTarget: 'Electron',
  },
  {
    id: '2',
    name: 'Pure Fusion Engine',
    description: 'Autonomous Meta ads AI engine',
    stack: 'FastAPI + Next.js + Supabase',
    progress: 35,
    sectionsTotal: 10,
    sectionsDone: 4,
    openBugs: 0,
    openTangents: 3,
    lastActive: '1 day ago',
    status: 'blocked',
    deployTarget: 'Railway',
  },
]

const STATUS_COLOR: Record<Project['status'], string> = {
  active:  'var(--accent)',
  blocked: '#f0c040',
  done:    '#4ade80',
  idle:    'rgba(255,255,255,0.2)',
}

const STATUS_LABEL: Record<Project['status'], string> = {
  active:  'Active',
  blocked: 'Blocked',
  done:    'Done',
  idle:    'Idle',
}

const STATUS_DOT: Record<Project['status'], string> = {
  active:  '●',
  blocked: '▲',
  done:    '✓',
  idle:    '○',
}

interface Props {
  onOpenCanvas: (projectId: string) => void
  onNewProject: () => void
}

export default function Dashboard({ onOpenCanvas, onNewProject }: Props) {
  const [search, setSearch] = useState('')

  const filtered = MOCK_PROJECTS.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalProjects  = MOCK_PROJECTS.length
  const activeProjects = MOCK_PROJECTS.filter(p => p.status === 'active').length
  const totalBugs      = MOCK_PROJECTS.reduce((a, p) => a + p.openBugs, 0)
  const totalTangents  = MOCK_PROJECTS.reduce((a, p) => a + p.openTangents, 0)

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

      {/* Project Cards */}
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
              {project.deployTarget && <span>Deploy: {project.deployTarget}</span>}
              <span>Last active: {project.lastActive}</span>
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
                onClick={() => onOpenCanvas(project.id)}
              >
                Open Canvas →
              </button>
              <button className={styles.warBtn}>War Room</button>
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
    </div>
  )
}
