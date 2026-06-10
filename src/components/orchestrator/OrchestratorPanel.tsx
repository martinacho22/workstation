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
          Describe your project below — phases appear here automatically
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
          const bp        = project?.blueprint?.find(b => b.label === node.data.label)
          const isCurrent = node.id === activeNodeId
          return (
            <div
              key={node.id}
              className={[
                styles.phase,
                styles[`phase_${node.data.status}`],
                isCurrent ? styles.phaseCurrent : '',
              ].join(' ')}
              onClick={() => setActiveNode(isCurrent ? null : node.id)}
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
  generating:  'Generating blueprint…',
  critiquing:  'Reviewing for stress points…',
  'laying-out': 'Calculating layout…',
  done:        '',
}

function OrchestratorChat() {
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
      : "Describe what you want to build. I'll plan it, ask a few questions, then lay the phases on the canvas automatically.",
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
      // Replace existing pipeline status message instead of appending
      const withoutPrev = prev.filter(m => !Object.values(PHASE_LABELS).includes(m.content))
      return [...withoutPrev, {
        id: nanoid(6), role: 'assistant', content: label,
        timestamp: Date.now(), isSystem: true,
      }]
    })
  }, [blueprintPhase, blueprintLoading])

  // Blueprint done — show critique and confirm
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
        parts.push('\nClick any node to open its workspace.')
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

    // ── Grill Me phase ────────────────────────────────────────────────────
    if (phase === 'grilling') {
      await answerGrill(text)
      return
    }

    // ── General orchestrator chat ─────────────────────────────────────────
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

      // If no project yet → auto start grill flow
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
  return (
    <div className={styles.panel}>
      <div className={styles.roadmapZone}>
        <div className={styles.zoneLabel}>Roadmap</div>
        <RoadmapSection />
      </div>

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
