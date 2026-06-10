import { useEffect, useRef, useState } from 'react'
import { useWorkstationStore }    from '@/store/useWorkstationStore'
import { useChatSessionsStore }   from '@/store/chatSessionsStore'
import styles from './ElectronHeader.module.css'

interface CLIStatus {
  installed:     boolean
  authenticated: boolean
  version:       string | null
}

/**
 * ElectronHeader — fixed 40px bar, always visible.
 *
 * Every element is interactive:
 *  - Project name  → project switcher dropdown
 *  - Stack chip    → inline stack editor
 *  - 3/5 progress  → jumps canvas to next incomplete node
 *  - ● Claude      → CLI diagnostics panel
 *
 * Global token health bar: aggregates all open chat sessions.
 * Pulses red if any session is in the danger zone (>80k est. tokens).
 */

const TOKEN_WARN = 40_000
const TOKEN_CRIT = 80_000

function estimateTokens(msgs: { content: string }[]): number {
  return msgs.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 700)
}

export default function ElectronHeader() {
  const {
    project, projects, nodes,
    switchProject, updateProject,
    setActiveNode,
  } = useWorkstationStore()

  const { sessions } = useChatSessionsStore()

  const [cli, setCli]                    = useState<CLIStatus | null>(null)
  const [showSwitcher, setShowSwitcher]   = useState(false)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [showSettings, setShowSettings]    = useState(false)
  const [stackEdit, setStackEdit]          = useState('')
  const [diagnostics, setDiagnostics]      = useState<string | null>(null)

  const switcherRef    = useRef<HTMLDivElement>(null)
  const diagnosticsRef = useRef<HTMLDivElement>(null)
  const settingsRef    = useRef<HTMLDivElement>(null)

  // Check CLI on mount
  useEffect(() => {
    const api = (window as any).electron
    if (!api?.claude?.status) return
    api.claude.status().then((s: CLIStatus) => setCli(s))
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node))
        setShowSwitcher(false)
      if (diagnosticsRef.current && !diagnosticsRef.current.contains(e.target as Node))
        setShowDiagnostics(false)
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node))
        setShowSettings(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Section stats
  const sections = nodes.filter(n => n.data.kind === 'section')
  const done     = sections.filter(n => n.data.status === 'done').length
  const total    = sections.length
  const blocked  = sections.filter(n => n.data.status === 'blocked').length
  const active   = sections.filter(n => n.data.status === 'active').length

  const cliState = !cli
    ? 'checking'
    : !cli.installed
    ? 'missing'
    : !cli.authenticated
    ? 'unauthed'
    : 'ok'

  // Global token health
  const tokenHealths = Object.keys(sessions).map(nodeId => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return 0
    return estimateTokens(node.data.chatHistory ?? [])
  })
  const maxTokens   = Math.max(0, ...tokenHealths)
  const tokenState  = maxTokens > TOKEN_CRIT ? 'crit' : maxTokens > TOKEN_WARN ? 'warn' : 'ok'
  const hasSessions = Object.keys(sessions).length > 0

  // ── Actions ──────────────────────────────────────────────────────────────

  function jumpToNext() {
    const next = sections.find(n => n.data.status !== 'done')
    if (next) {
      setActiveNode(next.id)
      window.dispatchEvent(new CustomEvent('workstation:focusNode', { detail: { id: next.id } }))
    }
  }

  async function runDiagnostics() {
    setDiagnostics('Running…')
    const api = (window as any).electron
    if (!api?.claude?.diagnose) {
      setDiagnostics('Diagnostics not available in browser mode.\nRun the Electron app for full diagnostics.')
      return
    }
    try {
      const result = await api.claude.diagnose()
      setDiagnostics(result)
    } catch (e) {
      setDiagnostics(`Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <header className={styles.header}>

      {/* Traffic light zone — Electron native window controls */}
      <div className={styles.trafficLightZone} />

      {/* ── Project name → drop-down switch ── */}
      <div ref={switcherRef} style={{ position: 'relative' }}>
        <button
          className={`${styles.interactive} ${styles.projectBtn}`}
          onClick={() => setShowSwitcher(v => !v)}
          title="Switch project"
        >
          {project ? project.name : 'No project'}
          <span className={styles.chevron}>{showSwitcher ? '▲' : '▾'}</span>
        </button>

        {showSwitcher && (
          <div className={styles.dropdown}>
            {projects.length === 0 && (
              <div className={styles.dropdownEmpty}>No projects yet</div>
            )}
            {projects.map(p => (
              <button
                key={p.id}
                className={`${styles.dropdownItem} ${p.id === project?.id ? styles.dropdownItemActive : ''}`}
                onClick={() => { switchProject(p.id); setShowSwitcher(false) }}
              >
                <span className={styles.dropdownName}>{p.name}</span>
                {p.stack && <span className={styles.dropdownStack}>{p.stack}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Stack chip → inline editor ── */}
      {project && (
        <div ref={settingsRef} style={{ position: 'relative' }}>
          {showSettings ? (
            <div className={styles.stackEditWrap}>
              <input
                className={styles.stackInput}
                value={stackEdit}
                onChange={e => setStackEdit(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    updateProject({ stack: stackEdit.trim() })
                    setShowSettings(false)
                  }
                  if (e.key === 'Escape') setShowSettings(false)
                }}
                onBlur={() => setShowSettings(false)}
                autoFocus
                placeholder="e.g. Next.js + Supabase"
              />
            </div>
          ) : project.stack ? (
            <button
              className={`${styles.interactive} ${styles.chip}`}
              onClick={() => { setStackEdit(project.stack ?? ''); setShowSettings(true) }}
              title="Edit stack"
            >
              {project.stack}
            </button>
          ) : (
            <button
              className={`${styles.interactive} ${styles.chip}`}
              onClick={() => { setStackEdit(''); setShowSettings(true) }}
              title="Set project stack"
              style={{ opacity: 0.3, fontStyle: 'italic' }}
            >
              + stack
            </button>
          )}
        </div>
      )}

      {/* ── Progress → jump to next undoned node ── */}
      {total > 0 && (
        <button
          className={`${styles.interactive} ${styles.progressBtn}`}
          onClick={jumpToNext}
          title="Jump to next incomplete section"
        >
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${Math.round((done / total) * 100)}%` }}
            />
          </div>
          <span className={styles.progressText}>
            {done}/{total}
            {blocked > 0 && <> · <span className={styles.blockedDot}>{blocked} blocked</span></>}
            {active > 0 && blocked === 0 && <> · <span className={styles.activeDot}>{active} active</span></>}
          </span>
        </button>
      )}

      {/* ── Global token health ── */}
      {hasSessions && (
        <div
          className={`${styles.tokenHealth} ${styles[`token_${tokenState}`]}`}
          title={
            tokenState === 'crit'
              ? '⚠ One or more sessions are past 80k tokens. End a session to start fresh.'
              : tokenState === 'warn'
              ? `~${Math.round(maxTokens / 1000)}k tokens across open sessions`
              : 'Context health good'
          }
        >
          <span className={`${styles.tokenDot} ${tokenState === 'crit' ? styles.tokenPulse : ''}`} />
          <span className={styles.tokenLabel}>
            {tokenState === 'ok'   && 'Context OK'}
            {tokenState === 'warn' && 'Filling up'}
            {tokenState === 'crit' && '⚠ Start fresh'}
          </span>
        </div>
      )}

      {/* ── CLI status → diagnostics ── */}
      <div className={styles.cliBlock} ref={diagnosticsRef}>
        <button
          className={styles.cliBtn}
          onClick={() => { setShowDiagnostics(v => !v); if (!diagnostics) runDiagnostics() }}
          title="Claude CLI diagnostics"
        >
          <span className={`${styles.cliDot} ${styles[`cliDot_${cliState}`]}`} />
          <span className={styles.cliLabel}>
            {cliState === 'checking'  && 'Checking…'}
            {cliState === 'missing'   && 'CLI missing'}
            {cliState === 'unauthed'  && 'Not logged in'}
            {cliState === 'ok'        && `Claude ${cli?.version ?? ''}`}
          </span>
        </button>

        {showDiagnostics && (
          <div className={styles.diagnosticsPanel}>
            <div className={styles.diagnosticsTitle}>CLI Diagnostics</div>
            <pre className={styles.diagnosticsOutput}>
              {diagnostics ?? 'Loading…'}
            </pre>
            <button className={styles.diagnosticsRefresh} onClick={runDiagnostics}>
              ↺ Refresh
            </button>
          </div>
        )}
      </div>

    </header>
  )
}
