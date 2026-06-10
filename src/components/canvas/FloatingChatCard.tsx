import { useState, useRef, useEffect, useCallback } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import { streamClaude } from '@/lib/claudeRunner'
import { ChatMessage } from '@/types'
import { nanoid } from 'nanoid'
import styles from './FloatingChatCard.module.css'

/**
 * FloatingChatCard
 *
 * A draggable, minimisable chat card that floats above the canvas.
 * - Spawns on the right side when a node becomes active
 * - Can be dragged anywhere
 * - Minimise → collapses to a small pill (stays visible)
 * - Clicking another node → chat collapses into that node's accent dot
 */

interface Props {
  nodeId: string
  onClose: () => void
}

const DEFAULT_POS = { x: window.innerWidth - 400, y: 100 }

export default function FloatingChatCard({ nodeId, onClose }: Props) {
  const { nodes, project, addChatMessage, updateNodeStatus } = useWorkstationStore()
  const node = nodes.find(n => n.id === nodeId)

  const [input, setInput]               = useState('')
  const [streaming, setStreaming]       = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [minimised, setMinimised]       = useState(false)
  const [pos, setPos]                   = useState(DEFAULT_POS)

  // Drag state
  const dragging    = useRef(false)
  const dragOffset  = useRef({ x: 0, y: 0 })
  const cardRef     = useRef<HTMLDivElement>(null)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [node?.data.chatHistory, streamBuffer])

  useEffect(() => {
    if (!minimised) inputRef.current?.focus()
  }, [minimised, nodeId])

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Only drag from the header
    dragging.current = true
    dragOffset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    }
    e.preventDefault()
  }, [pos])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return
      setPos({
        x: Math.max(0, Math.min(window.innerWidth  - 360, e.clientX - dragOffset.current.x)),
        y: Math.max(40, Math.min(window.innerHeight - 80,  e.clientY - dragOffset.current.y)),
      })
    }
    function onMouseUp() { dragging.current = false }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',   onMouseUp)
    }
  }, [])

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
      `You are a senior developer planning companion for "${node.data.label}".`,
      project ? `Project: ${project.name}. Stack: ${project.stack}.` : '',
      blueprint?.description ? `Goal: ${blueprint.description}` : '',
      node.data.handoffDoc
        ? `Last session: ${node.data.handoffDoc.currentStatus}. Next: ${node.data.handoffDoc.nextSteps}`
        : 'First session.',
      `This chat is for planning and thinking through the approach.`,
      `Be concise and direct. Ask before large structural changes.`,
    ].filter(Boolean).join('\n')

    const histCtx  = node.data.chatHistory.slice(-10)
      .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
      .join('\n')
    const fullPrompt = histCtx
      ? `${histCtx}\nHuman: ${userMsg.content}`
      : userMsg.content

    try {
      let accumulated = ''
      const fullText = await streamClaude(fullPrompt, (chunk) => {
        accumulated += chunk
        setStreamBuffer(accumulated)
      }, { skipPermissions: false, systemPrompt })

      setStreamBuffer('')
      addChatMessage(node.id, {
        id: nanoid(), role: 'assistant',
        content: fullText || accumulated, timestamp: Date.now(),
      })
      // Auto-mark active when first message is sent
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

  if (!node) return null

  const blueprint   = project?.blueprint?.find(b => b.label === node.data.label)
  const msgCount    = node.data.chatHistory.length

  // ── Minimised pill ────────────────────────────────────────────────────────

  if (minimised) {
    return (
      <div
        className={styles.pill}
        style={{ left: pos.x, top: pos.y }}
        onClick={() => setMinimised(false)}
        onMouseDown={onMouseDown}
        ref={cardRef}
      >
        <span className={styles.pillDot} />
        <span className={styles.pillLabel}>{node.data.label}</span>
        {msgCount > 0 && <span className={styles.pillCount}>{msgCount}</span>}
      </div>
    )
  }

  // ── Full card ─────────────────────────────────────────────────────────────

  return (
    <div
      className={styles.card}
      style={{ left: pos.x, top: pos.y }}
      ref={cardRef}
    >
      {/* Drag handle */}
      <div className={styles.header} onMouseDown={onMouseDown}>
        <div className={styles.headerLeft}>
          <span className={styles.accentDot} />
          <span className={styles.headerTitle}>{node.data.label}</span>
          {blueprint?.description && (
            <span className={styles.headerDesc}>{blueprint.description}</span>
          )}
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.iconBtn}
            onClick={() => setMinimised(true)}
            title="Minimise"
          >
            –
          </button>
          <button
            className={styles.iconBtn}
            onClick={onClose}
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {node.data.chatHistory.length === 0 && !streaming && (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>{node.data.label}</div>
            <div className={styles.emptyHint}>
              {node.data.handoffDoc
                ? `Continuing: ${node.data.handoffDoc.currentStatus}`
                : 'Ask a planning question or think through the approach here.'}
            </div>
          </div>
        )}

        {node.data.chatHistory.map(msg => (
          <div key={msg.id} className={`${styles.msg} ${styles[`msg_${msg.role}`]}`}>
            <span className={styles.roleLabel}>
              {msg.role === 'user' ? 'You' : 'Claude'}
            </span>
            <div className={styles.msgContent}>
              {msg.content.split('\n').map((line, i) => (
                <p
                  key={i}
                  className={
                    line.startsWith('    ') || line.startsWith('\t')
                      ? styles.codeLine
                      : styles.textLine
                  }
                >
                  {line || <br />}
                </p>
              ))}
            </div>
          </div>
        ))}

        {streaming && (
          <div className={`${styles.msg} ${styles.msg_assistant}`}>
            <span className={styles.roleLabel}>Claude</span>
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

      {/* Input */}
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
