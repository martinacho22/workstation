import { useState, useRef, useEffect } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import { runClaude } from '@/lib/claudeRunner'
import { nanoid } from 'nanoid'
import styles from './OrchestratorPanel.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrchestratorMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  action?: 'spawn_node' | 'grill' | 'plan'
}

// ─── Roadmap Section ──────────────────────────────────────────────────────────

function RoadmapSection() {
  const { nodes, project, setActiveNode, activeNodeId } = useWorkstationStore()
  const sections = nodes.filter(n => n.data.kind === 'section')
  const total    = sections.length
  const done     = sections.filter(n => n.data.status === 'done').length
  const active   = sections.filter(n => n.data.status === 'active').length
  const blocked  = sections.filter(n => n.data.status === 'blocked').length

  if (!project || total === 0) {
    return (
      <div className={styles.roadmapEmpty}>
        <span className={styles.roadmapEmptyText}>
          No phases yet — describe your project in the chat below
        </span>
      </div>
    )
  }

  return (
    <div className={styles.roadmap}>
      <div className={styles.roadmapHeader}>
        <div className={styles.roadmapBar}>
          <div
            className={styles.roadmapFill}
            style={{ width: total > 0 ? `${Math.round((done / total) * 100)}%` : '0%' }}
          />
        </div>
        <div className={styles.roadmapStats}>
          <span className={styles.statDone}>{done} done</span>
          {active  > 0 && <span className={styles.statActive}>{active} active</span>}
          {blocked > 0 && <span className={styles.statBlocked}>{blocked} blocked</span>}
          <span className={styles.statTotal}>{total} total</span>
        </div>
      </div>

      <div className={styles.phases}>
        {sections.map((node, i) => {
          const bp       = project?.blueprint?.find(b => b.label === node.data.label)
          const isCurrent = node.id === activeNodeId
          return (
            <div
              key={node.id}
              className={[
                styles.phase,
                styles[`phase_${node.data.status}`],
                isCurrent ? styles.phaseCurrent : '',
              ].join(' ')}
              onClick={() => setActiveNode(node.id)}
              title={bp?.description ?? node.data.label}
            >
              <div className={styles.phaseLeft}>
                <span className={styles.phaseIndex}>{i + 1}</span>
                <span className={styles.phaseDot} data-status={node.data.status} />
              </div>
              <div className={styles.phaseBody}>
                <span className={styles.phaseLabel}>{node.data.label}</span>
                {bp?.description && (
                  <span className={styles.phaseDesc}>{bp.description}</span>
                )}
              </div>
              <span className={styles.phaseStatus}>{node.data.status}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tasks Section ────────────────────────────────────────────────────────────

function TasksSection() {
  const { nodes, setActiveNode } = useWorkstationStore()
  const tasks = nodes.filter(n => n.data.kind === 'section')

  const active  = tasks.filter(n => n.data.status === 'active')
  const blocked = tasks.filter(n => n.data.status === 'blocked')
  const idle    = tasks.filter(n => n.data.status === 'idle')
  const done    = tasks.filter(n => n.data.status === 'done')

  const groups = [
    { label: 'Active',  items: active,  color: 'var(--accent)' },
    { label: 'Blocked', items: blocked, color: '#f0c040' },
    { label: 'Pending', items: idle,    color: 'rgba(255,255,255,0.3)' },
    { label: 'Done',    items: done,    color: '#4ade80' },
  ].filter(g => g.items.length > 0)

  if (tasks.length === 0) {
    return (
      <div className={styles.tasksEmpty}>
        <span className={styles.tasksEmptyText}>Tasks appear once a blueprint is generated</span>
      </div>
    )
  }

  return (
    <div className={styles.tasks}>
      {groups.map(group => (
        <div key={group.label} className={styles.taskGroup}>
          <div className={styles.taskGroupLabel} style={{ color: group.color }}>
            {group.label} · {group.items.length}
          </div>
          {group.items.map(node => (
            <div
              key={node.id}
              className={styles.taskItem}
              onClick={() => setActiveNode(node.id)}
            >
              <span className={styles.taskDot} style={{ background: group.color }} />
              <span className={styles.taskLabel}>{node.data.label}</span>
              {node.data.chatHistory?.length > 0 && (
                <span className={styles.taskMsgCount}>{node.data.chatHistory.length}</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Orchestrator Chat ────────────────────────────────────────────────────────

function OrchestratorChat() {
  const store = useWorkstationStore()
  const { project, grillLoading, grillQuestion, grillAnswers, startGrill, answerGrill, finishGrill, generateBlueprint } = store

  const [messages, setMessages] = useState<OrchestratorMessage[]>([{
    id: 'init',
    role: 'assistant',
    content: project
      ? `"${project.name}" is open. What are we working on next?`
      : `Describe what you want to build. I'll plan it out with you.`,
    timestamp: Date.now(),
  }])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [phase, setPhase]     = useState<'chat' | 'grilling' | 'blueprinting' | 'done'>('chat')
  const bottomRef             = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, grillQuestion])

  // Sync grill question into messages
  useEffect(() => {
    if (grillQuestion && phase === 'grilling') {
      const parts = grillQuestion.split('\n\nRecommendation:')
      const q   = parts[0].trim()
      const rec = parts[1]?.trim()
      setMessages(prev => {
        if (prev.some(m => m.content.startsWith(q))) return prev
        return [...prev, {
          id: nanoid(6),
          role: 'assistant',
          content: q + (rec ? `\n\nSuggested: ${rec}` : ''),
          timestamp: Date.now(),
          action: 'grill',
        }]
      })
    }
  }, [grillQuestion, phase])

  // Grill done → offer blueprint
  useEffect(() => {
    if (!grillLoading && grillAnswers.length >= 6 && phase === 'grilling' && !grillQuestion) {
      setPhase('blueprinting')
      setMessages(prev => [...prev, {
        id: nanoid(6),
        role: 'assistant',
        content: `I have a clear picture of what you're building. Ready to generate the blueprint and create phases on the canvas?`,
        timestamp: Date.now(),
        action: 'plan',
      }])
    }
  }, [grillLoading, grillAnswers.length, phase, grillQuestion])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    setMessages(prev => [...prev, {
      id: nanoid(6), role: 'user', content: text, timestamp: Date.now(),
    }])

    if (phase === 'grilling') {
      await answerGrill(text)
      return
    }

    if (phase === 'blueprinting') {
      const yes = /yes|go|generate|create|do it|yep|sure|ok/i.test(text)
      if (yes) {
        setMessages(prev => [...prev, {
          id: nanoid(6), role: 'assistant',
          content: 'Generating blueprint…', timestamp: Date.now(),
        }])
        finishGrill()
        await generateBlueprint()
        setPhase('done')
        setMessages(prev => [...prev, {
          id: nanoid(6), role: 'assistant',
          content: 'Phases created on the canvas. Double-click any node to open a work session.',
          timestamp: Date.now(),
        }])
      } else {
        setMessages(prev => [...prev, {
          id: nanoid(6), role: 'assistant',
          content: 'What do you want to adjust before generating?',
          timestamp: Date.now(),
        }])
      }
      return
    }

    // General orchestrator chat
    setLoading(true)
    try {
      const ctx = store.buildProjectContext()
      const sectionSummary = ctx.sections.map(s =>
        `[${s.status === 'done' ? 'x' : s.status === 'blocked' ? '!' : ' '}] ${s.label}`
      ).join('\n')

      const history = messages.slice(-6).map(m =>
        `${m.role === 'user' ? 'Dev' : 'Orchestrator'}: ${m.content}`
      ).join('\n')

      const startGrilling = /grill me|start grilling|ask me|interview me/i.test(text)

      if (startGrilling) {
        setPhase('grilling')
        await startGrill(text)
        return
      }

      const prompt = `You are a senior engineering lead inside a developer tool called Workstation.
Help plan, coordinate and unblock the developer's work at a HIGH LEVEL. No code. Max 2-3 sentences.

Project: ${ctx.projectName || 'none'} | Stack: ${ctx.stack || 'unknown'}
Phases:\n${sectionSummary || 'none yet'}

Recent:\n${history}

Dev: ${text}`

      const response = await runClaude(prompt)

      const shouldOfferGrill = !project && /build|create|make|app|project|feature/i.test(text)

      setMessages(prev => [...prev, {
        id: nanoid(6), role: 'assistant',
        content: response + (shouldOfferGrill ? '\n\nType "grill me" to plan this out.' : ''),
        timestamp: Date.now(),
      }])

      if (!project && shouldOfferGrill) {
        setPhase('grilling')
        setTimeout(() => startGrill(text), 600)
      }

    } catch {
      setMessages(prev => [...prev, {
        id: nanoid(6), role: 'assistant',
        content: 'Claude CLI not responding. Check Settings.',
        timestamp: Date.now(),
      }])
    } finally {
      setLoading(false)
    }
  }

  const isWaiting = loading || grillLoading

  return (
    <div className={styles.chat}>
      <div className={styles.chatMessages}>
        {messages.map(msg => (
          <div key={msg.id} className={`${styles.chatMsg} ${styles[`chatMsg_${msg.role}`]}`}>
            {msg.role === 'assistant' && <span className={styles.chatAvatar}>◈</span>}
            <div className={styles.chatBubble}>
              {msg.content.split('\n').map((line, i, arr) => (
                <span key={i}>{line}{i < arr.length - 1 ? <br /> : null}</span>
              ))}
            </div>
          </div>
        ))}
        {isWaiting && (
          <div className={`${styles.chatMsg} ${styles.chatMsg_assistant}`}>
            <span className={styles.chatAvatar}>◈</span>
            <div className={styles.chatBubble}>
              <span className={styles.typingDots}><span /><span /><span /></span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className={styles.chatInputRow}>
        <textarea
          className={styles.chatInput}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
          }}
          placeholder={
            phase === 'grilling'     ? 'Answer or type "skip"…' :
            phase === 'blueprinting' ? 'Type "yes" to generate…' :
                                       'Plan, ask, or describe what\'s next…'
          }
          rows={1}
          disabled={isWaiting}
        />
        <button
          className={styles.chatSend}
          onClick={handleSend}
          disabled={isWaiting || !input.trim()}
        >
          ↵
        </button>
      </div>
    </div>
  )
}

// ─── Panel Root ───────────────────────────────────────────────────────────────

interface Props {
  /** When false (non-canvas screens), the chat is hidden to reduce noise */
  showChat?: boolean
}

export default function OrchestratorPanel({ showChat = true }: Props) {
  return (
    <div className={styles.panel}>
      {/* Top third — roadmap */}
      <div className={styles.roadmapZone}>
        <div className={styles.zoneLabel}>Roadmap</div>
        <RoadmapSection />
      </div>

      {/* Bottom — tasks always visible, chat only on canvas */}
      <div className={styles.bottomZone}>
        <div className={showChat ? styles.tasksZone : styles.tasksZoneFull}>
          <div className={styles.zoneLabel}>Tasks</div>
          <TasksSection />
        </div>

        {showChat && (
          <div className={styles.chatZone}>
            <div className={styles.zoneLabel}>Orchestrator</div>
            <OrchestratorChat />
          </div>
        )}
      </div>
    </div>
  )
}
