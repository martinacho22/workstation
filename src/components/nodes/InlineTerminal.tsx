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

/**
 * InlineTerminal — a compact Claude Code launcher that lives
 * directly on the canvas, attached below a node.
 * 
 * It is NOT a full-screen takeover. The canvas stays fully interactive.
 */
export default function InlineTerminal({ nodeId, onClose }: Props) {
  const { nodes, project, addChatMessage } = useWorkstationStore()
  const node = nodes.find(n => n.id === nodeId)

  const [presetKind, setPresetKind] = useState<SessionPresetKind>(
    () => inferPresetKind(node?.data.label ?? '')
  )
  const [launching, setLaunching] = useState(false)
  const [launched, setLaunched]   = useState(false)

  if (!node) return null

  const preset    = SESSION_PRESETS[presetKind]
  const blueprint = project?.blueprint?.find(b => b.label === node.data.label)
  const cwd       = project?.projectDir ?? project?.repoPath ?? '~'

  async function launch() {
    setLaunching(true)
    try {
      const electronAPI = (window as any).electron
      if (!electronAPI?.terminal?.create) {
        throw new Error('Electron terminal API not available')
      }

      const bootPrompt = preset.bootPrompt({
        projectName:    project?.name ?? 'this project',
        sectionLabel:   node!.data.label,
        sectionGoal:    blueprint?.description ?? node!.data.label,
        stack:          project?.stack ?? '',
        handoffSummary: node!.data.handoffDoc
          ? `${node!.data.handoffDoc.currentStatus}. Next: ${node!.data.handoffDoc.nextSteps}`
          : undefined,
        projectDir: project?.projectDir ?? project?.repoPath ?? '.',
      })

      await electronAPI.terminal.create({
        id:              nanoid(6),
        shell:           'claude',
        skipPermissions: true,
        cwd:             project?.projectDir ?? project?.repoPath ?? undefined,
        presetPrompt:    bootPrompt,
      })

      setLaunched(true)
      addChatMessage(nodeId, {
        id:        nanoid(),
        role:      'assistant',
        content:   `Claude Code launched (${preset.label}) in \`${cwd}\`.\n\nBoot prompt sent.`,
        timestamp: Date.now(),
      })
    } catch (err) {
      addChatMessage(nodeId, {
        id:        nanoid(),
        role:      'assistant',
        content:   `Launch failed: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      })
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className={styles.terminal}>
      {/* Drag handle / header */}
      <div className={styles.header}>
        <span className={styles.icon}>⌘</span>
        <span className={styles.title}>Claude Code — {node.data.label}</span>
        <button className={styles.closeBtn} onClick={onClose} title="Close terminal">×</button>
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

      {/* Goal from blueprint */}
      {blueprint?.description && (
        <div className={styles.goal}>{blueprint.description}</div>
      )}

      {/* Handoff from last session */}
      {node.data.handoffDoc && (
        <div className={styles.handoff}>
          <span className={styles.handoffKey}>Last:</span>
          <span className={styles.handoffVal}>{node.data.handoffDoc.currentStatus}</span>
        </div>
      )}

      {/* Launch button */}
      <button
        className={[styles.launchBtn, launched ? styles.launched : ''].join(' ')}
        onClick={launch}
        disabled={launching || launched}
      >
        {launching ? 'Launching…' : launched ? '✓ Session open' : 'Launch Claude Code'}
      </button>

      {launched && (
        <div className={styles.launchedNote}>
          Running in external window. Close this panel when done.
        </div>
      )}
    </div>
  )
}
