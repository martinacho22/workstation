import { useEffect, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import styles from './TerminalPane.module.css'

interface Props {
  nodeId: string
  active: boolean
}

type ShellMode = 'bash' | 'claude' | 'claude-skip'

export default function TerminalPane({ nodeId, active }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const [running, setRunning] = useState(false)
  const [mode, setMode] = useState<ShellMode>('bash')

  function startTerminal(selectedMode: ShellMode) {
    if (!containerRef.current || !(window as any).electron) return

    const term = new Terminal({
      theme: {
        background: '#0d0d14',
        foreground: '#00ff88',
        cursor: '#00ff88',
        selectionBackground: 'rgba(0, 255, 136, 0.2)',
        black: '#0a0a0f',
        green: '#00ff88',
        brightGreen: '#33ffaa',
      },
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      fontSize: 12,
      lineHeight: 1.5,
      cursorBlink: true,
      cursorStyle: 'block',
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()

    termRef.current = term
    fitRef.current = fit

    const shellMap: Record<ShellMode, string> = {
      bash: 'bash',
      claude: 'claude',
      'claude-skip': 'claude',
    }

    const skipPerms = selectedMode === 'claude-skip'

    ;(window as any).electron.terminal.create({
      id: nodeId,
      shell: shellMap[selectedMode],
      skipPermissions: skipPerms,
    })

    // Receive output
    const cleanData = (window as any).electron.terminal.onData(nodeId, (data: string) => {
      term.write(data)
    })

    const cleanExit = (window as any).electron.terminal.onExit(nodeId, () => {
      term.write('\r\n\x1b[90m[process exited]\x1b[0m\r\n')
      setRunning(false)
    })

    // Send input
    term.onData((data) => {
      ;(window as any).electron.terminal.write(nodeId, data)
    })

    setRunning(true)
    setMode(selectedMode)

    return () => {
      cleanData?.()
      cleanExit?.()
    }
  }

  useEffect(() => {
    const handleResize = () => fitRef.current?.fit()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className={styles.pane}>
      <div className={styles.toolbar}>
        <span className={styles.label}>Terminal</span>
        {!running ? (
          <div className={styles.modeButtons}>
            <button className={styles.modeBtn} onClick={() => startTerminal('bash')}>bash</button>
            <button className={`${styles.modeBtn} ${styles.claude}`} onClick={() => startTerminal('claude')}>claude</button>
            <button className={`${styles.modeBtn} ${styles.danger}`} onClick={() => startTerminal('claude-skip')}>claude --skip</button>
          </div>
        ) : (
          <span className={styles.runningBadge}>{mode}</span>
        )}
      </div>
      <div
        ref={containerRef}
        className={styles.terminal}
      />
    </div>
  )
}
