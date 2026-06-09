import { useState, useRef, useEffect } from 'react'
import { WorkstationNodeData, ChatMessage } from '@/types'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import { nanoid } from 'nanoid'
import styles from './ChatPane.module.css'

interface Props {
  nodeId: string
  data: WorkstationNodeData
}

export default function ChatPane({ nodeId, data }: Props) {
  const { addChatMessage, project } = useWorkstationStore()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [data.chatHistory])

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

    try {
      // Build system context from project + node + skills
      const enabledSkills = data.skills.filter(s => s.enabled).map(s => s.label).join(', ')
      const systemPrompt = [
        `You are a senior developer assistant inside Workstation.`,
        project ? `Project: ${project.name}. Stack: ${project.stack}. ${project.description}` : '',
        `Current section: "${data.label}".`,
        enabledSkills ? `Active skills: ${enabledSkills}.` : '',
        data.handoffDoc ? `Last handoff: ${data.handoffDoc.currentStatus}. Next: ${data.handoffDoc.nextSteps}` : '',
        `Be concise. Think step by step. Reason before acting. Terminal-first.`,
      ].filter(Boolean).join('\n')

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': (window as any).__ANTHROPIC_KEY__ || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            ...data.chatHistory.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMsg.content },
          ],
        }),
      })

      const json = await res.json()
      const content = json.content?.[0]?.text || 'No response.'

      addChatMessage(nodeId, {
        id: nanoid(),
        role: 'assistant',
        content,
        timestamp: Date.now(),
      })
    } catch (err) {
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
        <span className={styles.model}>claude-sonnet</span>
      </div>

      <div className={styles.messages}>
        {data.chatHistory.length === 0 && (
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
            <span className={styles.typing}>●●●</span>
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
