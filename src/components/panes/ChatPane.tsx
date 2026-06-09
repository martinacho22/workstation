import { useState, useRef, useEffect } from 'react'
import { WorkstationNodeData, ChatMessage } from '@/types'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import { streamClaude } from '@/lib/claudeRunner'
import { nanoid } from 'nanoid'
import styles from './ChatPane.module.css'

interface Props {
  nodeId: string
  data: WorkstationNodeData
  systemContext?: string
}

export default function ChatPane({ nodeId, data, systemContext }: Props) {
  const { addChatMessage, project } = useWorkstationStore()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const streamIdRef = useRef<string>('')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [data.chatHistory, streamBuffer])

  async function send() {
    if (!input.trim() || loading) return

    const userMsg: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }

    addChatMessage(nodeId, userMsg)
    setInput('')
    setLoading(true)
    setStreamBuffer('')

    const enabledSkills = data.skills?.filter(s => s.enabled).map(s => s.label).join(', ') || ''

    // Inline history — CLI -p mode is stateless so we pass context manually
    const historyContext = data.chatHistory
      .slice(-10)
      .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
      .join('\n')

    // Use custom systemContext if provided (e.g. from BugNode/DeployNode),
    // otherwise build standard section context
    const systemPrompt = systemContext || [
      `You are a senior developer assistant inside Workstation.`,
      project ? `Project: ${project.name}. Stack: ${project.stack}. ${project.description}` : '',
      `Current section: "${data.label}".`,
      enabledSkills ? `Active skills: ${enabledSkills}.` : '',
      data.handoffDoc ? `Last handoff: ${data.handoffDoc.currentStatus}. Next: ${data.handoffDoc.nextSteps}` : '',
      `Be concise. Think step by step. Terminal-first.`,
    ].filter(Boolean).join('\n')

    const fullPrompt = historyContext
      ? `${historyContext}\nHuman: ${userMsg.content}`
      : userMsg.content

    const streamId = nanoid(8)
    streamIdRef.current = streamId

    try {
      let accumulated = ''

      const fullText = await streamClaude(
        fullPrompt,
        (chunk) => {
          accumulated += chunk
          setStreamBuffer(accumulated)
        },
        {
          streamId,
          skipPermissions: data.skipPermissions,
          systemPrompt,
        }
      )

      setStreamBuffer('')

      addChatMessage(nodeId, {
        id: nanoid(),
        role: 'assistant',
        content: fullText || accumulated,
        timestamp: Date.now(),
      })
    } catch (err) {
      setStreamBuffer('')
      addChatMessage(nodeId, {
        id: nanoid(),
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: Date.now(),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.pane}>
      <div className={styles.toolbar}>
        <span className={styles.label}>Chat</span>
        <span className={styles.model}>claude · cli</span>
      </div>

      <div className={styles.messages}>
        {data.chatHistory.length === 0 && !loading && (
          <div className={styles.empty}>
            Ask Claude anything about this section.<br />
            Code runs in the terminal →
          </div>
        )}
        {data.chatHistory.map(msg => (
          <div key={msg.id} className={`${styles.msg} ${styles[msg.role]}`}>
            <span className={styles.roleLabel}>{msg.role === 'user' ? 'you' : 'claude'}</span>
            <pre className={styles.content}>{msg.content}</pre>
          </div>
        ))}
        {loading && (
          <div className={`${styles.msg} ${styles.assistant}`}>
            <span className={styles.roleLabel}>claude</span>
            {streamBuffer ? (
              <pre className={styles.content}>{streamBuffer}<span className={styles.cursor}>▌</span></pre>
            ) : (
              <span className={styles.typing}>●●●</span>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputRow}>
        <textarea
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Ask Claude... (Enter to send)"
          rows={2}
        />
        <button className={styles.sendBtn} onClick={send} disabled={loading}>
          {loading ? '…' : '↑'}
        </button>
      </div>
    </div>
  )
}
