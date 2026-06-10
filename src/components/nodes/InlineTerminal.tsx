import { useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import { SESSION_PRESETS, inferPresetKind } from '@/lib/sessionPresets'
import { SessionPresetKind } from '@/types'
import { nanoid } from 'nanoid'
import styles from './InlineTerminal.module.css'

interface Props {
  nodeId: string
  onClose: () => void
}

export default function InlineTerminal({ nodeId, onClose }: Props) {
  const { nodes, project, addChatMessage } = useWorkstationStore()
  const node = nodes.find(n => n.id === nodeId)

  const [presetKind, setPresetKind] = useState<SessionPresetKind>(
    () => inferPresetKind(node?.data.label ?? '')
  )
  const [launching, setLaunching] = useState(false)
  const [launched,  setLaunched]  = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  if (!node) return null

  const preset    = SESSION_PRESETS[presetKind]
  const blueprint = project?.blueprint?.find(b => b.label === node.data.label)
  const cwd       = project?.projectDir ?? project?.repoPath ?? '~'

  async function launch() {
    setLaunching(true)
    setError(null)

    try {
      const electronAPI = (window as any).electron

      // ── Guard: are we running inside Electron? ──────────────────────────
      if (!electronAPI?.terminal?.create) {
        throw new Error(
          'Terminal API not available.\n' +
          'Make sure you are running the Electron app (npm run electron:dev), ' +
          'not just the browser dev server.'
        )
      }

      // ── Build boot prompt ───────────────────────────────────────────────
      const bootPrompt = preset.bootPrompt({
        projectName:    project?.name    ?? 'this project',
        sectionLabel:   node.data.label,
        sectionGoal:    blueprint?.description ?? node.data.label,
        stack:          project?.stack   ?? '',
        handoffSummary: node.data.handoffDoc
          ? `${node.data.handoffDoc.currentStatus}. Next: ${node.data.handoffDoc.nextSteps}`
          : undefined,
        projectDir: project?.projectDir ?? project?.repoPath ?? '.',
      })

      // ── Launch ──────────────────────────────────────────────────────────
      const result = await electronAPI.terminal.create({
        id:              nanoid(6),
        shell:           'claude',
        skipPermissions: true,
        cwd:             project?.projectDir ?? project?.repoPath ?? undefined,
        presetPrompt:    bootPrompt,
      })

      // ── Handle error returned from main process ─────────────────────────
      if (!result?.success) {
        throw new Error(result?.error ?? 'Unknown launch error from main process')
      }

      // ── Success ─────────────────────────────────────────────────────────
      setLaunched(true)
      addChatMessage(nodeId, {
        id:        nanoid(),
        role:      'assistant',
        content:   `✓ Claude Code launched (${preset.label})\n\`${cwd}\`\n\nBoot prompt sent — Claude Code is initialising.`,
        timestamp: Date.now(),
      })

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      addChatMessage(nodeId, {
        id:        nanoid(),
        role:      'assistant',
        content:   `⚠ Launch failed:\n${msg}`,
        timestamp: Date.now(),
      })
    } finally {
      setLaunching(false)
    }
  }

  async function runDiagnostics() {
    try {
      const electronAPI = (window as any).electron
      if (!electronAPI) { setError('Not running in Electron — open via npm run electron:dev'); return }

      // Check PTY
      if (electronAPI.diagnostics?.pty) {
        const diag = await electronAPI.diagnostics.pty()
        setError(
          `Diagnostics:\n` +
          `node-pty: ${diag.ptyAvailable ? '✓ available' : '✗ not installed — run: npm install'}\n` +
          `Shell: ${diag.shell}\n` +
          `PATH: ${diag.path?.split(':').slice(0, 5).join('\n  ')}`
        )
      }

      // Check Claude status
      if (electronAPI.claude?.status) {
        const status = await electronAPI.claude.status()
        setError(prev =>
          (prev ?? '') + `\n\nClaude CLI:\n` +
          `installed: ${status.installed ? '✓' : '✗'}\n` +
          `authenticated: ${status.authenticated ? '✓' : '✗'}\n` +
          `version: ${status.version ?? 'n/a'}\n` +
          `path: ${status.path ?? 'not found'}\n` +
          (status.error ? `error: ${status.error}` : '')
        )
      }
    } catch (e) {
      setError(`Diagnostics failed: ${e}`)
    }
  }

  return (
    <div className={styles.terminal}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.icon}>⌘</span>
        <span className={styles.title}>Claude Code — {node.data.label}</span>
        <button className={styles.closeBtn} onClick={onClose} title="Close">×</button>
      </div>

      {/* CWD */}
      <div className={styles.cwd}>
        <span className={styles.cwdLabel}>cwd</span>
        <span className={styles.cwdPath}>{cwd}</span>
      </div>

      {/* Preset selector */}
      <div className={styles.presetRow}>
        {Object.values(SESSION_PRESETS).map(p => (
          <button
            key={p.kind}
            className={[styles.presetChip, presetKind === p.kind ? styles.presetActive : ''].join(' ')}
            onClick={() => setPresetKind(p.kind as SessionPresetKind)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Blueprint goal */}
      {blueprint?.description && (
        <div className={styles.goal}>{blueprint.description}</div>
      )}

      {/* Last handoff */}
      {node.data.handoffDoc && (
        <div className={styles.handoff}>
          <span className={styles.handoffKey}>Last:</span>
          <span className={styles.handoffVal}>{node.data.handoffDoc.currentStatus}</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className={styles.errorBox}>
          <pre className={styles.errorText}>{error}</pre>
          <button className={styles.diagBtn} onClick={runDiagnostics}>Run diagnostics</button>
        </div>
      )}

      {/* Launch button */}
      <button
        className={[styles.launchBtn, launched ? styles.launched : '', error ? styles.launchRetry : ''].join(' ')}
        onClick={launch}
        disabled={launching}
      >
        {launching ? 'Launching…' : launched ? '✓ Session open' : error ? 'Retry launch' : 'Launch Claude Code'}
      </button>

      {launched && (
        <div className={styles.launchedNote}>
          Running in external window — close this panel when done.
        </div>
      )}
    </div>
  )
}
