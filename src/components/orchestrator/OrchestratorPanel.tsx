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
  const { nodes, project, setActiveNode } = useWorkstationStore()
  const sections = nodes.filter(n => n.data.kind === 'section')
  const total    = sections.length
  const done     = sections.filter(n => n.data.status === 'done').length
  const active   = sections.filter(n => n.data.status === 'active').length
  const blocked  = sections.filter(n => n.data.status === 'blocked').length

  if (!project || total === 0) {
    return (
      <div className={styles.roadmapEmpty}>
        <span className={styles.roadmapEmptyText}>
          No phases yet — describe your project below
        </span>
      </div>
    )
  }

  return (
    <div className={styles.roadmap}>
      {/* Progress summary */}
      <div className={styles.roadmapHeader}>
        <div className={styles.roadmapBar}>
          <div
            className={styles.roadmapFill}
            style={{ width: total > 0 ? `${Math.round((done / total) * 100)}%` : '0%' }}
          />
        </div>
        <div className={styles.roadmapStats}>
          <span className={styles.statDone}>{done} done</span>
          {active > 0 && <span className={styles.statActive}>{active} active</span>}
          {blocked > 0 && <span className={styles.statBlocked}>{blocked} blocked</span>}
          <span className={styles.statTotal}>{total} total</span>
        </div>
      </div>

      {/* Phase list */}
      <div className={styles.phases}>
        {sections.map((node, i) => {
          const bp = project?.blueprint?.find(b => b.label === node.data.label)
          return (
            <div
              key={node.id}
              className={`${styles.phase} ${styles[`phase_${node.data.status}`]}`}
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
    { label: 'Active', items: active,  color: 'var(--accent)' },
    { label: 'Blocked', items: blocked, color: '#f0c040' },
    { label: 'Pending', items: idle,    color: 'rgba(255,255,255,0.3)' },
    { label: 'Done',    items: done,    color: '#4ade80' },
  ].filter(g => g.items.length > 0)

  if (tasks.length === 0) {
    return (
      <div className={styles.tasksEmpty}>
        <span className={styles.tasksEmptyText}>Tasks appear here</span>
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
      ? `Project "${project.name}" is open. What are we working on?`
      : 'Describe what you want to build. I\'ll ask you a few questions then plan the work.',
    timestamp: Date.now(),
  }])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [phase, setPhase]       = useState<'chat' | 'grilling' | 'blueprinting' | 'done'>('chat')
  const bottomRef               = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, grillQuestion])

  // Sync grill question into messages
  useEffect(() => {
    if (grillQuestion && phase === 'grilling') {
      const parts = grillQuestion.split('\n\nRecommendation:')
      const q = parts[0].trim()
      const rec = parts[1]?.trim()
      setMessages(prev => {
        // Don't duplicate
        if (prev.some(m => m.content.startsWith(q))) return prev
        return [...prev, {
          id: nanoid(6),
          role: 'assistant',
          content: q + (rec ? `\n\n— Suggested: ${rec}` : ''),
          timestamp: Date.now(),
          action: 'grill',
        }]
      })
    }
  }, [grillQuestion, phase])

  // Grill done — offer blueprint
  useEffect(() => {
    if (!grillLoading && grillAnswers.length >= 6 && phase === 'grilling' && !grillQuestion) {
      setPhase('blueprinting')
      setMessages(prev => [...prev, {
        id: nanoid(6),
        role: 'assistant',
        content: `Good — I have a clear picture. Ready to generate the project blueprint and create phases on the canvas?`,
        timestamp: Date.now(),
        action: 'plan',
      }])
    }
  }, [grillLoading, grillAnswers.length, phase, grillQuestion])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const userMsg: OrchestratorMessage = {
      id: nanoid(6),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])

    // Phase: grilling
    if (phase === 'grilling') {
      await answerGrill(text)
      return
    }

    // Phase: blueprinting — user said yes/go/generate etc
    if (phase === 'blueprinting') {
      const yes = /yes|go|generate|create|do it|yep|sure|ok/i.test(text)
      if (yes) {
        setMessages(prev => [...prev, {
          id: nanoid(6),
          role: 'assistant',
          content: 'Generating blueprint and creating phases on the canvas…',
          timestamp: Date.now(),
        }])
        finishGrill()
        await generateBlueprint()
        setPhase('done')
        setMessages(prev => [...prev, {
          id: nanoid(6),
          role: 'assistant',
          content: 'Phases created. Double-click any node on the canvas to open a work session. Come back here when you want to plan the next move.',
          timestamp: Date.now(),
        }])
      } else {
        setMessages(prev => [...prev, {
          id: nanoid(6),
          role: 'assistant',
          content: 'Sure — what do you want to adjust before we generate the blueprint?',
          timestamp: Date.now(),
        }])
      }
      return
    }

    // Phase: chat / done — general orchestrator response
    setLoading(true)
    try {
      const ctx = store.buildProjectContext()
      const sectionSummary = ctx.sections.map(s =>
        `[${s.status === 'done' ? 'x' : s.status === 'blocked' ? '!' : ' '}] ${s.label}`
      ).join('\n')

      const history = messages.slice(-6).map(m =>
        `${m.role === 'user' ? 'Developer' : 'Orchestrator'}: ${m.content}`
      ).join('\n')

      const prompt = `You are a senior engineering lead and project orchestrator inside a developer tool called Workstation.
Your job is to help plan, coordinate and unblock a developer's work at a HIGH LEVEL.
You do NOT write code. You plan phases, spot parallelization opportunities, ask clarifying questions, and keep the developer moving.
Be concise. Max 3 sentences unless the developer asks for more detail.

Project: ${ctx.projectName} | Stack: ${ctx.stack}
Phases:
${sectionSummary || 'No phases yet'}

Recent conversation:
${history}

Developer: ${text}

Respond as the orchestrator. If the developer is describing a new project or a major new feature, say you'll ask a few questions to plan it — then they should type "grill me" to start.`

      const response = await runClaude(prompt)

      // Check if we should start grilling
      if (/grill me|start grilling|ask me|interview me/i.test(text) && phase === 'chat') {
        setPhase('grilling')
        await startGrill(text)
        return
      }

      // Check if user is describing a new thing and we should offer to grill
      const shouldOfferGrill = !project && /build|create|make|app|project|feature/i.test(text)

      setMessages(prev => [...prev, {
        id: nanoid(6),
        role: 'assistant',
        content: response + (shouldOfferGrill ? '\n\nType "grill me" when you\'re ready to plan this out.' : ''),
        timestamp: Date.now(),
      }])

      // Auto-start grill if user is starting fresh with an idea
      if (!project && shouldOfferGrill) {
        setPhase('grilling')
        setTimeout(() => startGrill(text), 800)
      }

    } catch (e) {
      setMessages(prev => [...prev, {
        id: nanoid(6),
        role: 'assistant',
        content: 'Claude CLI not responding. Check your connection in Settings.',
        timestamp: Date.now(),
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isWaiting = loading || grillLoading

  return (
    <div className={styles.chat}>
      <div className={styles.chatMessages}>
        {messages.map(msg => (
          <div key={msg.id} className={`${styles.chatMsg} ${styles[`chatMsg_${msg.role}`]}`}>
            {msg.role === 'assistant' && (
              <span className={styles.chatAvatar}>O</span>
            )}
            <div className={styles.chatBubble}>
              {msg.content.split('\n').map((line, i) => (
                <span key={i}>{line}{i < msg.content.split('\n').length - 1 ? <br /> : null}</span>
              ))}
            </div>
          </div>
        ))}
        {isWaiting && (
          <div className={`${styles.chatMsg} ${styles.chatMsg_assistant}`}>
            <span className={styles.chatAvatar}>O</span>
            <div className={styles.chatBubble}>
              <span className={styles.typingDots}>
                <span /><span /><span />
              </span>
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
          onKeyDown={handleKeyDown}
          placeholder={
            phase === 'grilling'    ? 'Answer or type "skip"…' :
            phase === 'blueprinting'? 'Type "yes" to generate blueprint…' :
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

export default function OrchestratorPanel() {
  return (
    <div className={styles.panel}>
      {/* Top third — roadmap */}
      <div className={styles.roadmapZone}>
        <div className={styles.zoneLabel}>Roadmap</div>
        <RoadmapSection />
      </div>

      {/* Bottom two-thirds — tasks + chat */}
      <div className={styles.bottomZone}>
        <div className={styles.tasksZone}>
          <div className={styles.zoneLabel}>Tasks</div>
          <TasksSection />
        </div>
        <div className={styles.chatZone}>
          <div className={styles.zoneLabel}>Orchestrator</div>
          <OrchestratorChat />
        </div>
      </div>
    </div>
  )
}
