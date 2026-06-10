import { useState, useRef, useEffect } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import { runClaude } from '@/lib/claudeRunner'
import { parseIntent, ORCHESTRATOR_SYSTEM_PROMPT } from '@/lib/intentParser'
import { nanoid } from 'nanoid'
import styles from './OrchestratorPanel.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrchestratorMessage {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  timestamp: number
  isGrill?:  boolean
  isSystem?: boolean
}

// ─── Pill Rail — compact roadmap strip shown after blueprint exists ───────────

function PillRail() {
  const { nodes, project, setActiveNode, activeNodeId } = useWorkstationStore()
  const sections = nodes.filter(n => n.data.kind === 'section')

  if (!project || sections.length === 0) return null

  const done    = sections.filter(n => n.data.status === 'done').length
  const total   = sections.length

  return (
    <div className={styles.pillRail}>
      {/* Progress bar — ultra thin */}
      <div className={styles.pillProgress}>
        <div
          className={styles.pillProgressFill}
          style={{ width: total > 0 ? `${Math.round((done / total) * 100)}%` : '0%' }}
        />
      </div>

      {/* Phase pills */}
      <div className={styles.pillList}>
        {sections.map((node, i) => {
          const bp       = project?.blueprint?.find(b => b.label === node.data.label)
          const isCurrent = node.id === activeNodeId
          return (
            <button
              key={node.id}
              className={[
                styles.pill,
                styles[`pill_${node.data.status}`],
                isCurrent ? styles.pillCurrent : '',
              ].join(' ')}
              onClick={() => setActiveNode(isCurrent ? null : node.id)}
              title={bp?.description ?? node.data.label}
            >
              <span className={styles.pillDot} data-status={node.data.status} />
              <span className={styles.pillLabel}>
                {i + 1}. {node.data.label.length > 10 ? node.data.label.slice(0, 10) + '…' : node.data.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tasks Section ────────────────────────────────────────────────────────────

function TasksSection() {
  const { nodes, setActiveNode, activeNodeId } = useWorkstationStore()
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
              className={`${styles.taskItem} ${node.id === activeNodeId ? styles.taskItemActive : ''}`}
              onClick={() => setActiveNode(node.id === activeNodeId ? null : node.id)}
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

const PHASE_LABELS: Record<string, string> = {
  generating:   'Generating blueprint…',
  critiquing:   'Reviewing for stress points…',
  'laying-out': 'Calculating layout…',
  done:         '',
}

function OrchestratorChat({ hasBlueprint }: { hasBlueprint: boolean }) {
  const store = useWorkstationStore()
  const {
    project, nodes,
    grillLoading, grillQuestion, grillAnswers,
    startGrill, answerGrill,
    blueprintLoading, blueprintPhase, blueprintCritique,
    executeCommands,
  } = store

  const sectionCount = nodes.filter(n => n.data.kind === 'section').length

  const [messages, setMessages] = useState<OrchestratorMessage[]>([{
    id:        'init',
    role:      'assistant',
    content:   project
      ? `"${project.name}" is open. ${sectionCount > 0 ? `${sectionCount} phases on the canvas.` : 'No phases yet — what are we building first?'}`
      : "Describe what you want to build. I'll ask a few questions, then lay the phases on the canvas automatically.",
    timestamp: Date.now(),
  }])

  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [phase, setPhase]     = useState<'chat' | 'grilling'>('chat')
  const bottomRef             = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, grillQuestion, blueprintPhase])

  // Sync grill question into messages
  useEffect(() => {
    if (grillQuestion && phase === 'grilling') {
      const parts = grillQuestion.split('\n\nRecommendation:')
      const q     = parts[0].trim()
      const rec   = parts[1]?.trim()
      setMessages(prev => {
        if (prev.some(m => m.content.startsWith(q))) return prev
        return [...prev, {
          id:        nanoid(6),
          role:      'assistant',
          content:   q + (rec ? `\n\nSuggested: ${rec}` : ''),
          timestamp: Date.now(),
          isGrill:   true,
        }]
      })
    }
  }, [grillQuestion, phase])

  // Show 3-pass pipeline status messages
  useEffect(() => {
    if (!blueprintLoading || blueprintPhase === 'idle' || blueprintPhase === 'done') return
    const label = PHASE_LABELS[blueprintPhase]
    if (!label) return
    setMessages(prev => {
      const withoutPrev = prev.filter(m => !Object.values(PHASE_LABELS).includes(m.content))
      return [...withoutPrev, {
        id: nanoid(6), role: 'assistant', content: label,
        timestamp: Date.now(), isSystem: true,
      }]
    })
  }, [blueprintPhase, blueprintLoading])

  // Blueprint done
  useEffect(() => {
    if (!blueprintLoading && blueprintPhase === 'done' && sectionCount > 0 && phase === 'grilling') {
      setPhase('chat')
      setMessages(prev => {
        const alreadyConfirmed = prev.some(m => m.content.startsWith('Done —'))
        if (alreadyConfirmed) return prev
        const filtered = prev.filter(m => !Object.values(PHASE_LABELS).some(l => l && m.content === l))
        const parts: string[] = [`Done — ${sectionCount} phases placed on the canvas.`]
        if (blueprintCritique && !blueprintCritique.startsWith('Critic pass skipped')) {
          parts.push(`\nReview: ${blueprintCritique}`)
        }
        parts.push('\nClick any node to open its planning chat.')
        return [...filtered, {
          id: nanoid(6), role: 'assistant',
          content: parts.join(''), timestamp: Date.now(), isSystem: true,
        }]
      })
    }
  }, [blueprintLoading, blueprintPhase, sectionCount, phase, blueprintCritique])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading || grillLoading) return
    setInput('')

    setMessages(prev => [...prev, {
      id: nanoid(6), role: 'user', content: text, timestamp: Date.now(),
    }])

    if (phase === 'grilling') {
      await answerGrill(text)
      return
    }

    setLoading(true)
    try {
      const ctx            = store.buildProjectContext()
      const sectionSummary = ctx.sections.map(s =>
        `[${s.status === 'done' ? 'x' : s.status === 'blocked' ? '!' : ' '}] ${s.label}`
      ).join('\n') || 'none yet'

      const recentHistory = messages.slice(-8).map(m =>
        `${m.role === 'user' ? 'Developer' : 'Orchestrator'}: ${m.content}`
      ).join('\n')

      const userPrompt = `Project: ${ctx.projectName || 'none'} | Stack: ${ctx.stack || 'unknown'}
Existing phases:\n${sectionSummary}

Recent conversation:\n${recentHistory}

Developer: ${text}`

      const raw = await runClaude(userPrompt, { systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT })
      const { cleanText, commands } = parseIntent(raw)

      if (commands.length > 0) executeCommands(commands)

      setMessages(prev => [...prev, {
        id: nanoid(6), role: 'assistant',
        content: cleanText || (commands.length > 0 ? 'Canvas updated.' : '…'),
        timestamp: Date.now(),
      }])

      if (!project && commands.length === 0) {
        setPhase('grilling')
        await startGrill(text)
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: nanoid(6), role: 'assistant',
        content: err instanceof Error ? err.message : 'Claude CLI not responding. Check Settings.',
        timestamp: Date.now(),
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (phase === 'grilling' && !input.trim() && grillQuestion) {
        const rec = grillQuestion.split('\n\nRecommendation:')[1]?.trim()
        if (rec) { setInput(rec); setTimeout(() => handleSend(), 50); return }
      }
      handleSend()
    }
  }

  const isWaiting = loading || grillLoading || blueprintLoading

  return (
    <div className={styles.chat}>
      {/* Identity bar */}
      <div className={styles.chatIdentityBar}>
        <div className={styles.chatIdentityAvatar}>◈</div>
        <span className={styles.chatIdentityLabel}>Architect</span>
        <span className={styles.chatIdentitySub}>project planner</span>
      </div>

      <div className={styles.chatMessages}>
        {messages.map(msg => (
          <div
            key={msg.id}
            className={[
              styles.chatMsg,
              styles[`chatMsg_${msg.role}`],
              msg.isSystem ? styles.chatMsg_system : '',
              msg.isGrill  ? styles.chatMsg_grill  : '',
            ].join(' ')}
          >
            {msg.role === 'assistant' && (
              <span className={styles.chatAvatar}>{msg.isSystem ? '→' : '◈'}</span>
            )}
            <div className={styles.chatBubble}>
              {msg.content.split('\n').map((line, i, arr) => (
                <span key={i}>{line}{i < arr.length - 1 ? <br /> : null}</span>
              ))}
            </div>
          </div>
        ))}

        {isWaiting && !blueprintLoading && (
          <div className={`${styles.chatMsg} ${styles.chatMsg_assistant}`}>
            <span className={styles.chatAvatar}>◈</span>
            <div className={styles.chatBubble}>
              <span className={styles.typingDots}><span /><span /><span /></span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {phase === 'grilling' && grillQuestion && (
        <div className={styles.grillHint}>
          Press Enter with empty input to accept the suggestion
        </div>
      )}

      <div className={styles.chatInputRow}>
        <textarea
          className={styles.chatInput}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            phase === 'grilling'  ? 'Answer (Enter to accept suggestion)…' :
            !project              ? 'Describe what you want to build…' :
            'What are we building next?'
          }
          rows={1}
          disabled={isWaiting}
        />
        <button
          className={styles.chatSend}
          onClick={handleSend}
          disabled={isWaiting || (!input.trim() && phase !== 'grilling')}
        >
          ↵
        </button>
      </div>
    </div>
  )
}

// ─── Panel Root ───────────────────────────────────────────────────────────────

interface Props {
  showChat?: boolean
}

export default function OrchestratorPanel({ showChat = true }: Props) {
  const { nodes, project } = useWorkstationStore()
  const hasBlueprint = nodes.filter(n => n.data.kind === 'section').length > 0

  // Before blueprint: full panel is chat only
  // After blueprint: pill rail on top, tasks+chat below
  if (!hasBlueprint) {
    return (
      <div className={styles.panel}>
        {showChat && <OrchestratorChat hasBlueprint={false} />}
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      {/* Compact pill rail — 32px, replaces the old roadmap zone */}
      <PillRail />

      <div className={styles.bottomZone}>
        <div className={showChat ? styles.tasksZone : styles.tasksZoneFull}>
          <div className={styles.zoneLabel}>Tasks</div>
          <TasksSection />
        </div>

        {showChat && (
          <div className={styles.chatZone}>
            <OrchestratorChat hasBlueprint={true} />
          </div>
        )}
      </div>
    </div>
  )
}
