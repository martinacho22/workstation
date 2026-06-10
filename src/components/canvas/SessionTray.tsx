import { useState } from 'react'
import { useChatSessionsStore } from '@/store/chatSessionsStore'
import { useWorkstationStore }  from '@/store/useWorkstationStore'
import styles from './SessionTray.module.css'

/**
 * SessionTray
 *
 * Fixed top-left of the canvas. Shows one pill per open chat session,
 * ordered by roadmap position (blueprint order, left→right).
 *
 * Pill states:
 *  ● pulsing green  = chat open + terminal running
 *  ● solid blue     = chat open, no terminal
 *  ○ grey           = minimised
 *
 * Click → restore/minimise toggle
 * Hover → shows last message preview as a micro-card
 */

export default function SessionTray() {
  const { orderedSessions, toggleMinimise } = useChatSessionsStore()
  const { nodes }                           = useWorkstationStore()
  const [hoverId, setHoverId]               = useState<string | null>(null)

  const sessions = orderedSessions()
  if (sessions.length === 0) return null

  return (
    <div className={styles.tray}>
      {sessions.map((session, idx) => {
        const node     = nodes.find(n => n.id === session.nodeId)
        if (!node) return null

        const msgCount  = node.data.chatHistory?.length ?? 0
        const lastMsg   = node.data.chatHistory?.at(-1)
        const isOpen    = !session.minimised
        const hasTerminal = (node.data as any).terminalOpen ?? false
        const label     = node.data.label

        return (
          <div
            key={session.nodeId}
            className={styles.pillWrap}
            onMouseEnter={() => setHoverId(session.nodeId)}
            onMouseLeave={() => setHoverId(null)}
          >
            <button
              className={[
                styles.pill,
                isOpen      ? styles.pillOpen      : styles.pillMinimised,
                hasTerminal ? styles.pillTerminal   : '',
              ].join(' ')}
              onClick={() => toggleMinimise(session.nodeId)}
              title={`${label} — ${isOpen ? 'click to minimise' : 'click to restore'}`}
            >
              {/* Status dot */}
              <span className={[
                styles.dot,
                hasTerminal ? styles.dotTerminal :
                isOpen      ? styles.dotOpen     : styles.dotMinimised,
              ].join(' ')} />

              {/* Roadmap position badge */}
              <span className={styles.order}>{idx + 1}</span>

              {/* Label */}
              <span className={styles.label}>
                {label.length > 12 ? label.slice(0, 11) + '…' : label}
              </span>

              {/* Unread count */}
              {msgCount > 0 && (
                <span className={styles.count}>{msgCount}</span>
              )}
            </button>

            {/* Hover preview card */}
            {hoverId === session.nodeId && lastMsg && (
              <div className={styles.preview}>
                <div className={styles.previewRole}>
                  {lastMsg.role === 'user' ? 'You' : 'Claude'}
                </div>
                <div className={styles.previewText}>
                  {lastMsg.content.slice(0, 120)}{lastMsg.content.length > 120 ? '…' : ''}
                </div>
              </div>
            )}

            {/* No messages yet */}
            {hoverId === session.nodeId && !lastMsg && (
              <div className={styles.preview}>
                <div className={styles.previewText} style={{ opacity: 0.4, fontStyle: 'italic' }}>
                  No messages yet
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
