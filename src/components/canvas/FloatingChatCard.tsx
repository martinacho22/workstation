import { useState, useRef, useEffect, useCallback } from 'react'
import { useWorkstationStore }   from '@/store/useWorkstationStore'
import { useChatSessionsStore }  from '@/store/chatSessionsStore'
import { streamClaude }          from '@/lib/claudeRunner'
import { ChatMessage }           from '@/types'
import { nanoid }                from 'nanoid'
import styles from './FloatingChatCard.module.css'

interface Props {
  nodeId: string
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000)  return 'just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3600_000)}h ago`
}

/**
 * Simple heuristic to detect if a response contains a technical decision
 * that should be logged automatically.
 */
function detectDecision(text: string): { decision: string; reason: string } | null {
  const lines = text.split('\n').filter(l => l.trim())
  for (const line of lines) {
    const lower = line.toLowerCase()
    // Detect "I'll use X", "we should use X", "let's go with X", "decided to use X"
    const useMatch = line.match(/(?:I'?ll|we should|let's go with|decided to|going to) use\s+([\w\s./#-]+)/i)
    if (useMatch) {
      return {
        decision: `Use ${useMatch[1].trim()}`,
        reason: line.trim(),
      }
    }
    // Detect "chose X over Y"
    const choseMatch = line.match(/(?:chose|chosen|picked|selecting)\s+([\w\s./#-]+)\s+(?:over|instead of|rather than)\s+([\w\s./#-]+)/i)
    if (choseMatch) {
      return {
        decision: `Use ${choseMatch[1].trim()} over ${choseMatch[2].trim()}`,
        reason: line.trim(),
      }
    }
  }
  return null
}

export default function FloatingChatCard({ nodeId }: Props) {
  const { nodes, project, addChatMessage, updateNodeStatus, addDecision } = useWorkstationStore()
  const { sessions, closeChat, minimiseChat, updatePos }                  = useChatSessionsStore()

  const session = sessions[nodeId]
  const node    = nodes.find(n => n.id === nodeId)

  const [input, setInput]               = useState('')
  const [streaming, setStreaming]       = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [terminalTs, setTerminalTs]     = useState<number | null>(null)

  const dragging   = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const cardRef    = useRef<HTMLDivElement>(null)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  const phaseIndex = project?.blueprint
    ? project.blueprint.findIndex(b => b.label === node?.data.label) + 1
    : session?.order + 1 ?? 1

  // ── Terminal activity — subscribe to real terminal.onData ─────────────────
  useEffect(() => {
    const electronAPI = (window as any).electron
    if (!electronAPI?.terminal?.onData) return

    // Subscribe to terminal data for this node's terminal sessions
    // Use a wildcard approach — listen for any terminal:data events and
    // check if they're related to this node
    const unsub = electronAPI.terminal.onData(nodeId, () => {
      setTerminalTs(Date.now())
    })

    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, [nodeId])

  // Also listen for terminal exit events to clear the activity indicator
  useEffect(() => {
    const electronAPI = (window as any).electron
    if (!electronAPI?.terminal?.onExit) return

    const unsub = electronAPI.terminal.onExit(nodeId, () => {
      // Keep the dot but mark it as stale after 30s
      setTerminalTs(Date.now())
    })

    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, [nodeId])

  // ── Auto-fade terminal activity after 30s of silence ─────────────────────
  useEffect(() => {
    if (!terminalTs) return
    const elapsed = Date.now() - terminalTs
    if (elapsed > 30_000) return

    const timer = setTimeout(() => {
      setTerminalTs(null)
    }, 30_000 - elapsed)

    return () => clearTimeout(timer)
  }, [terminalTs])

  // ── Scroll to bottom on new messages ─────────────────────────────────────
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

      const content = fullText || accumulated
      addChatMessage(node.id, {
        id: nanoid(), role: 'assistant',
        content, timestamp: Date.now(),
      })

      // Auto-detect and log decisions from Claude's response
      if (content && project) {
        const decision = detectDecision(content)
        if (decision) {
          addDecision(decision.decision, decision.reason, node.data.label)
        }
      }

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

  const pos = session.pos

  // Has terminal activity (green dot) if within last 30s
  const hasTerminalActivity = terminalTs !== null && (Date.now() - terminalTs) < 30_000

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
        {hasTerminalActivity && (
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
            Planning companion
          </span>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.iconBtn}
            onClick={() => minimiseChat(nodeId)}
            title="Minimise"
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
