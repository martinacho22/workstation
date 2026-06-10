import { useEffect, useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './ElectronHeader.module.css'

interface CLIStatus {
  installed: boolean
  authenticated: boolean
  version: string | null
}

export default function ElectronHeader() {
  const { project, nodes } = useWorkstationStore()
  const [cli, setCli] = useState<CLIStatus | null>(null)

  // Check CLI status once on mount
  useEffect(() => {
    const electronAPI = (window as any).electron
    if (!electronAPI?.claude?.status) return
    electronAPI.claude.status().then((s: CLIStatus) => setCli(s))
  }, [])

  const sections   = nodes.filter(n => n.data.kind === 'section')
  const done       = sections.filter(n => n.data.status === 'done').length
  const total      = sections.length
  const blocked    = sections.filter(n => n.data.status === 'blocked').length
  const active     = sections.filter(n => n.data.status === 'active').length

  const cliState = !cli
    ? 'checking'
    : !cli.installed
    ? 'missing'
    : !cli.authenticated
    ? 'unauthed'
    : 'ok'

  return (
    <header className={styles.header}>
      {/* Left — traffic light drag region (macOS needs -webkit-app-region:drag) */}
      <div className={styles.trafficLightZone} />

      {/* Centre-left — project identity */}
      <div className={styles.projectBlock}>
        {project ? (
          <>
            <span className={styles.projectName}>{project.name}</span>
            {project.stack && (
              <span className={styles.chip}>{project.stack}</span>
            )}
          </>
        ) : (
          <span className={styles.noProject}>No project open</span>
        )}
      </div>

      {/* Centre — progress */}
      {total > 0 && (
        <div className={styles.progressBlock}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${Math.round((done / total) * 100)}%` }}
            />
          </div>
          <span className={styles.progressText}>
            {done}/{total}
            {blocked > 0 && <span className={styles.blockedDot}> · {blocked} blocked</span>}
            {active > 0 && blocked === 0 && <span className={styles.activeDot}> · {active} active</span>}
          </span>
        </div>
      )}

      {/* Right — CLI status */}
      <div className={styles.cliBlock}>
        <span className={`${styles.cliDot} ${styles[cliState]}`} />
        <span className={styles.cliLabel}>
          {cliState === 'checking'  && 'Checking CLI…'}
          {cliState === 'missing'   && 'CLI not installed'}
          {cliState === 'unauthed'  && 'CLI not authenticated'}
          {cliState === 'ok'        && `Claude ${cli?.version ?? 'CLI'}`}
        </span>
      </div>
    </header>
  )
}
