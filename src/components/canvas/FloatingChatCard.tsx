import { useState, useRef, useEffect, useCallback } from 'react'
import { useWorkstationStore }   from '@/store/useWorkstationStore'
import { useChatSessionsStore }  from '@/store/chatSessionsStore'
import { streamClaude }          from '@/lib/claudeRunner'
import { ChatMessage }           from '@/types'
import { nanoid }                from 'nanoid'
import styles from './FloatingChatCard.module.css'

/**
 * FloatingChatCard — worker chat for a specific node.
 *
 * Visual identity:
 *  - Blue accent (#7c9eff) — distinct from orchestrator green (#00ff88)
 *  - Phase number badge instead of generic dot
 *  - Status bar at top: node name · status · terminal activity
 *  - Avatar is the phase number, not a generic symbol
 */

interface Props {
  nodeId: string
}

// Format ms since timestamp as "Xm ago" / "just now" etc.
function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000)  return 'just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3600_000)}h ago`
}

export default function FloatingChatCard({ nodeId }: Props) {
  const { nodes, project, addChatMessage, updateNodeStatus } = useWorkstationStore()
  const { sessions, closeChat, minimiseChat, updatePos }     = useChatSessionsStore()

  const session = sessions[nodeId]
  const node    = nodes.find(n => n.id === nodeId)

  const [input, setInput]               = useState('')
  const [streaming, setStreaming]       = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [terminalTs, setTerminalTs]     = useState<number | null>(null)

  // Drag
  const dragging   = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const cardRef    = useRef<HTMLDivElement>(null)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  // Phase order — position in blueprint
  const phaseIndex = project?.blueprint
    ? project.blueprint.findIndex(b => b.label === node?.data.label) + 1
    : session?.order + 1 ?? 1

  // Terminal activity — listen for terminal:activity events
  useEffect(() => {
    const electronAPI = (window as any).electron
    if (!electronAPI?.on) return
    const off = electronAPI.on?.(`terminal:activity:${nodeId}`, () => {
      setTerminalTs(Date.now())
    })
    return () => off?.()
  }, [nodeId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [node?.data.chatHistory, streamBuffer])

  useEffect(() => {
    if (session && !session.minimised) inputRef.current?.focus()
  }, [session?.minimised, nodeId])

  // ── Drag ──────────────────────────────────────────────────────────────────

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current   = true
    const pos          = session?.pos ?? { x: window.innerWidth - 400, y: 90 }
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    e.preventDefault()
  }, [session?.pos])

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return
      updatePos(nodeId, {
        x: Math.max(0,  Math.min(window.innerWidth  - 360, e.clientX - dragOffset.current.x)),
        y: Math.max(40, Math.min(window.innerHeight - 80,  e.clientY - dragOffset.current.y)),
      })
    }
    function onUp() { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [nodeId, updatePos])

  // ── Chat ──────────────────────────────────────────────────────────────────

  async function send() {
    if (!input.trim() || streaming || !node) return
    const userMsg: ChatMessage = {
      id: nanoid(), role: 'user', content: input.trim(), timestamp: Date.now(),
    }
    addChatMessage(node.id, userMsg)
    setInput('')
    setStreaming(true)
    setStreamBuffer('')

    const blueprint    = project?.blueprint?.find(b => b.label === node.data.label)
    const systemPrompt = [
      `You are a senior developer working on "${node.data.label}" (phase ${phaseIndex}).`,
      project ? `Project: ${project.name}. Stack: ${project.stack}.` : '',
      blueprint?.description ? `Goal: ${blueprint.description}` : '',
      node.data.handoffDoc
        ? `Last session: ${node.data.handoffDoc.currentStatus}. Next: ${node.data.handoffDoc.nextSteps}`
        : 'First session on this section.',
      `This chat is for planning and thinking through the approach. Be concise and direct.`,
    ].filter(Boolean).join('\n')

    const histCtx    = node.data.chatHistory.slice(-10)
      .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
      .join('\n')
    const fullPrompt = histCtx
      ? `${histCtx}\nHuman: ${userMsg.content}`
      : userMsg.content

    try {
      let accumulated = ''
      const fullText  = await streamClaude(fullPrompt, (chunk) => {
        accumulated += chunk
        setStreamBuffer(accumulated)
      }, { skipPermissions: false, systemPrompt })

      setStreamBuffer('')
      addChatMessage(node.id, {
        id: nanoid(), role: 'assistant',
        content: fullText || accumulated, timestamp: Date.now(),
      })
      if (node.data.status === 'idle') updateNodeStatus(node.id, 'active')
    } catch (err) {
      setStreamBuffer('')
      addChatMessage(node.id, {
        id: nanoid(), role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Unknown'}. Is Claude CLI running?`,
        timestamp: Date.now(),
      })
    } finally {
      setStreaming(false)
    }
  }

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!node || !session) return null
  if (session.minimised)  return null

  const blueprint = project?.blueprint?.find(b => b.label === node.data.label)
  const pos       = session.pos
  const hasTerminal = (node.data as any).terminalOpen ?? false

  // Status label
  const statusLabel = {
    idle:    'idle',
    active:  'active',
    done:    'done',
    blocked: 'blocked',
  }[node.data.status] ?? 'idle'

  // ── Full card ─────────────────────────────────────────────────────────────

  return (
    <div
      className={styles.card}
      style={{ left: pos.x, top: pos.y }}
      ref={cardRef}
    >
      {/* ── Status bar (top) — node identity ── */}
      <div className={styles.statusBar}>
        <div className={styles.statusLeft}>
          <span className={styles.phaseNum}>{phaseIndex}</span>
          <span className={styles.nodeName}>{node.data.label}</span>
          <span className={`${styles.statusBadge} ${styles[`status_${node.data.status}`]}`}>
            {statusLabel}
          </span>
        </div>
        {(hasTerminal || terminalTs) && (
          <div className={styles.terminalActivity}>
            <span className={styles.terminalDot} />
            <span className={styles.terminalLabel}>
              {terminalTs ? `Session ${timeAgo(terminalTs)}` : 'Session open'}
            </span>
          </div>
        )}
      </div>

      {/* ── Drag handle / header ── */}
      <div className={styles.header} onMouseDown={onMouseDown}>
        <div className={styles.headerLeft}>
          <span className={styles.headerDesc}>
            {blueprint?.description ?? 'Planning companion'}
          </span>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.iconBtn}
            onClick={() => minimiseChat(nodeId)}
            title="Minimise — keeps session alive in tray"
          >
            –
          </button>
          <button
            className={styles.iconBtnClose}
            onClick={() => closeChat(nodeId)}
            title="Close session"
          >
            ×
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className={styles.messages}>
        {node.data.chatHistory.length === 0 && !streaming && (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>Phase {phaseIndex} — {node.data.label}</div>
            <div className={styles.emptyHint}>
              {node.data.handoffDoc
                ? `Continuing: ${node.data.handoffDoc.currentStatus}`
                : 'Plan the approach here. Code runs in Claude Code below.'}
            </div>
          </div>
        )}

        {node.data.chatHistory.map(msg => (
          <div key={msg.id} className={`${styles.msg} ${styles[`msg_${msg.role}`]}`}>
            <span className={styles.roleLabel}>
              {msg.role === 'user' ? 'You' : `Claude · ph.${phaseIndex}`}
            </span>
            <div className={styles.msgContent}>
              {msg.content.split('\n').map((line, i) => (
                <p key={i} className={
                  line.startsWith('    ') || line.startsWith('\t')
                    ? styles.codeLine : styles.textLine
                }>
                  {line || <br />}
                </p>
              ))}
            </div>
          </div>
        ))}

        {streaming && (
          <div className={`${styles.msg} ${styles.msg_assistant}`}>
            <span className={styles.roleLabel}>Claude · ph.{phaseIndex}</span>
            {streamBuffer ? (
              <div className={styles.msgContent}>
                <p className={styles.textLine}>
                  {streamBuffer}<span className={styles.cursor}>▌</span>
                </p>
              </div>
            ) : (
              <span className={styles.thinking}>thinking…</span>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div className={styles.inputArea}>
        <textarea
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
          }}
          placeholder="Plan, think, ask… (Enter to send)"
          rows={2}
        />
        <button
          className={styles.sendBtn}
          onClick={send}
          disabled={streaming || !input.trim()}
        >
          {streaming ? '···' : '↵'}
        </button>
      </div>
    </div>
  )
}
