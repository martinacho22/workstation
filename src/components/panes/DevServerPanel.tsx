import { useCallback, useEffect, useRef, useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './DevServerPanel.module.css'

type DevStatus = 'idle' | 'starting' | 'ready' | 'error'

interface DevServerState {
  status: DevStatus
  port: number | null
  url: string | null
  output: string[]
  error: string | null
  command: string | null
}

export default function DevServerPanel() {
  const projectDir  = useWorkstationStore(s => s.project?.projectDir)
  const [state, setState] = useState<DevServerState>({
    status: 'idle', port: null, url: null,
    output: [], error: null, command: null,
  })
  const [expanded, setExpanded] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const outputEndRef = useRef<HTMLDivElement>(null)
  const cleanupRef   = useRef<(() => void)[]>([])

  // Auto-scroll output
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.output])

  // Check if already running on mount
  useEffect(() => {
    const api = (window as any).electron?.dev
    if (!api) return

    api.status().then((s: any) => {
      if (s?.running && s?.port) {
        setState(prev => ({
          ...prev,
          status: 'ready',
          port: s.port,
          url: `http://localhost:${s.port}`,
          output: s.output || [],
        }))
      }
    })
  }, [projectDir])

  // Subscribe to dev server events
  useEffect(() => {
    const api = (window as any).electron?.dev
    if (!api) return

    const unsubs: (() => void)[] = []
    cleanupRef.current = unsubs

    if (api.onReady) {
      unsubs.push(api.onReady((data: { port: number; url: string }) => {
        setState(prev => ({
          ...prev,
          status: 'ready',
          port: data.port,
          url: data.url,
          error: null,
        }))
      }))
    }

    if (api.onOutput) {
      unsubs.push(api.onOutput((data: { text: string }) => {
        setState(prev => ({
          ...prev,
          output: [...prev.output.slice(-200), data.text],
        }))
      }))
    }

    if (api.onExit) {
      unsubs.push(api.onExit(() => {
        setState(prev => ({
          ...prev,
          status: 'idle',
          port: null,
          url: null,
          output: [],
        }))
      }))
    }

    if (api.onError) {
      unsubs.push(api.onError((data: { error: string }) => {
        setState(prev => ({
          ...prev,
          status: 'error',
          error: data.error,
        }))
      }))
    }

    return () => { unsubs.forEach(fn => fn()) }
  }, [])

  const handleStart = useCallback(async () => {
    const api = (window as any).electron?.dev
    if (!api || !projectDir) return

    setState(prev => ({ ...prev, status: 'starting', output: [], error: null }))

    const result = await api.start(projectDir)
    if (!result.success) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: result.error || 'Failed to start dev server',
      }))
    } else if (result.alreadyRunning) {
      setState(prev => ({
        ...prev,
        status: 'ready',
        port: result.port,
        url: result.url,
        command: result.command,
      }))
    } else {
      setState(prev => ({
        ...prev,
        command: result.command,
        port: result.port,
      }))
    }
  }, [projectDir])

  const handleStop = useCallback(async () => {
    const api = (window as any).electron?.dev
    if (!api) return
    await api.stop()
    setState({ status: 'idle', port: null, url: null, output: [], error: null, command: null })
    setShowPreview(false)
  }, [])

  const handleRestart = useCallback(async () => {
    await handleStop()
    setTimeout(() => handleStart(), 300)
  }, [handleStop, handleStart])

  // ── Render ───────────────────────────────────────────────────────────────

  const isElectron = typeof (window as any).electron?.dev?.start === 'function'

  if (!isElectron) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.title}>Dev Server</span>
          <span className={styles.unavailable}>Unavailable</span>
        </div>
        <div className={styles.hint}>
          Dev server is only available in the Electron app.
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.container} ${expanded ? styles.expanded : ''}`}>
      {/* Header */}
      <div className={styles.header} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            className={`${styles.dot} ${
              state.status === 'ready'   ? styles.dotReady :
              state.status === 'starting' ? styles.dotStarting :
              state.status === 'error'    ? styles.dotError :
              styles.dotIdle
            }`}
          />
          <span className={styles.title}>Dev Server</span>
          {state.status === 'ready' && state.port && (
            <span className={styles.portBadge}>:{state.port}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {state.status === 'ready' && (
            <button
              className={styles.previewBtn}
              onClick={(e) => { e.stopPropagation(); setShowPreview(!showPreview) }}
              title={showPreview ? 'Close preview' : 'Open preview'}
            >
              {showPreview ? '✕' : '◻'}
            </button>
          )}
          <span className={styles.chevron}>{expanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {/* Controls */}
      {expanded && (
        <div className={styles.body}>
          <div className={styles.controls}>
            {state.status === 'idle' || state.status === 'error' ? (
              <button className={styles.startBtn} onClick={handleStart}>
                ▶ Start
              </button>
            ) : (
              <>
                <button className={styles.stopBtn} onClick={handleStop}>
                  ■ Stop
                </button>
                <button className={styles.restartBtn} onClick={handleRestart}>
                  ↻ Restart
                </button>
              </>
            )}

            {state.command && (
              <span className={styles.commandLabel}>
                {state.command}
              </span>
            )}
          </div>

          {/* Error state */}
          {state.error && (
            <div className={styles.error}>
              {state.error}
            </div>
          )}

          {/* Output log */}
          {state.output.length > 0 && (
            <div className={styles.output}>
              {state.output.map((line, i) => (
                <div key={i} className={styles.outputLine}>{line}</div>
              ))}
              <div ref={outputEndRef} />
            </div>
          )}

          {/* Status bar */}
          <div className={styles.statusBar}>
            {state.status === 'starting' && <span>Starting…</span>}
            {state.status === 'ready' && state.url && (
              <a
                className={styles.urlLink}
                href={state.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {state.url}
              </a>
            )}
            {state.status === 'idle' && projectDir && <span>Ready to start</span>}
            {state.status === 'idle' && !projectDir && <span>Open a project first</span>}
            {state.error && <span className={styles.errorText}>{state.error}</span>}
          </div>
        </div>
      )}

      {/* Preview iframe (when expanded and ready) */}
      {showPreview && state.status === 'ready' && state.url && (
        <div className={styles.preview}>
          <iframe
            src={state.url}
            className={styles.iframe}
            title="App Preview"
            sandbox="allow-scripts allow-same-origin allow-forms"
            loading="lazy"
          />
        </div>
      )}
    </div>
  )
}
