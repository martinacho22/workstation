import { useState, useRef, useEffect } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import { streamClaude } from '@/lib/claudeRunner'
import { ChatMessage } from '@/types'
import { nanoid } from 'nanoid'
import styles from './SessionView.module.css'

export default function SessionView() {
  const {
    activeNodeId, nodes, project,
    addChatMessage, endSession, sessionLoading,
    generateContextBlock, addBug, addDecision,
    updateNodeStatus,
  } = useWorkstationStore()

  const node = nodes.find(n => n.id === activeNodeId)

  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [sidebarTab, setSidebarTab] = useState<'context' | 'bugs' | 'decisions'>('context')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [contextCopied, setContextCopied] = useState(false)
  const [endingSession, setEndingSession] = useState(false)

  // Bug form
  const [bugDesc, setBugDesc] = useState('')
  const [showBugForm, setShowBugForm] = useState(false)

  // Decision form
  const [decisionText, setDecisionText] = useState('')
  const [decisionReason, setDecisionReason] = useState('')
  const [showDecisionForm, setShowDecisionForm] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [node?.data.chatHistory, streamBuffer])

  useEffect(() => {
    inputRef.current?.focus()
  }, [activeNodeId])

  if (!node) return null

  const contextBlock = generateContextBlock(node.id)
  const bugs = (project?.bugs ?? []).filter(b => b.affectedSection === node.data.label)
  const decisions = (project?.decisions ?? []).filter(d => d.sectionId === node.data.label)

  // Token estimate — rough: ~4 chars per token
  const historyTokens = node.data.chatHistory.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0)
  const contextZone =
    historyTokens < 40000 ? 'green' :
    historyTokens < 80000 ? 'yellow' : 'red'
  const tokenDisplay = historyTokens > 1000
    ? `~${Math.round(historyTokens / 1000)}k`
    : `~${historyTokens}`

  function copyContext() {
    navigator.clipboard.writeText(contextBlock)
    setContextCopied(true)
    setTimeout(() => setContextCopied(false), 1500)
  }

  async function send() {
    if (!input.trim() || streaming) return

    const userMsg: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    }
    addChatMessage(node.id, userMsg)
    setInput('')
    setStreaming(true)
    setStreamBuffer('')

    // Build system prompt from current project context
    const systemPrompt = [
      `You are a senior developer assistant working on "${node.data.label}".`,
      project ? `Project: ${project.name}. Stack: ${project.stack}.` : '',
      project?.blueprint?.find(b => b.label === node.data.label)?.description
        ? `Section goal: ${project.blueprint!.find(b => b.label === node.data.label)!.description}`
        : '',
      node.data.handoffDoc
        ? `Last session: ${node.data.handoffDoc.currentStatus}. Next: ${node.data.handoffDoc.nextSteps}`
        : 'This is the first session in this section.',
      `Be concise. Think step by step. Ask before making large structural changes.`,
    ].filter(Boolean).join('\n')

    // Pass last 10 messages as context (CLI is stateless)
    const historyContext = node.data.chatHistory
      .slice(-10)
      .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
      .join('\n')

    const fullPrompt = historyContext
      ? `${historyContext}\nHuman: ${userMsg.content}`
      : userMsg.content

    try {
      let accumulated = ''
      const fullText = await streamClaude(fullPrompt, (chunk) => {
        accumulated += chunk
        setStreamBuffer(accumulated)
      }, { skipPermissions: false, systemPrompt })

      setStreamBuffer('')
      addChatMessage(node.id, {
        id: nanoid(),
        role: 'assistant',
        content: fullText || accumulated,
        timestamp: Date.now(),
      })
    } catch (err) {
      setStreamBuffer('')
      addChatMessage(node.id, {
        id: nanoid(),
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}. Is Claude CLI connected?`,
        timestamp: Date.now(),
      })
    } finally {
      setStreaming(false)
    }
  }

  async function handleEndSession() {
    setEndingSession(true)
    await endSession(node.id)
    setEndingSession(false)
  }

  function handleAddBug() {
    if (!bugDesc.trim()) return
    addBug(bugDesc.trim(), node.data.label)
    setBugDesc('')
    setShowBugForm(false)
  }

  function handleAddDecision() {
    if (!decisionText.trim() || !decisionReason.trim()) return
    addDecision(decisionText.trim(), decisionReason.trim(), node.data.label)
    setDecisionText('')
    setDecisionReason('')
    setShowDecisionForm(false)
  }

  return (
    <div className={styles.session}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.projectCrumb}>{project?.name ?? 'Project'}</span>
          <span className={styles.crumbSep}>/</span>
          <span className={styles.sectionCrumb}>{node.data.label}</span>
        </div>

        <div className={styles.headerCenter}>
          {/* Context health meter */}
          <div className={`${styles.tokenMeter} ${styles[contextZone]}`}>
            <span className={styles.tokenDot} />
            <span className={styles.tokenLabel}>{tokenDisplay} tokens</span>
            {contextZone === 'yellow' && <span className={styles.tokenWarn}>context filling</span>}
            {contextZone === 'red' && <span className={styles.tokenWarn}>start fresh session</span>}
          </div>
        </div>

        <div className={styles.headerRight}>
          <button
            className={styles.sidebarToggle}
            onClick={() => setSidebarOpen(o => !o)}
          >
            {sidebarOpen ? 'Hide panel' : 'Show panel'}
          </button>

          <div className={styles.statusToggle}>
            <button
              className={`${styles.statusBtn} ${node.data.status === 'done' ? styles.statusDone : ''}`}
              onClick={() => updateNodeStatus(node.id, node.data.status === 'done' ? 'active' : 'done')}
            >
              {node.data.status === 'done' ? 'Reopen' : 'Mark done'}
            </button>
          </div>

          <button
            className={styles.endBtn}
            onClick={handleEndSession}
            disabled={endingSession || sessionLoading}
          >
            {endingSession ? 'Saving...' : 'End session'}
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {/* ── Chat ── */}
        <div className={styles.chatArea}>
          <div className={styles.messages}>
            {node.data.chatHistory.length === 0 && !streaming && (
              <div className={styles.emptyState}>
                <div className={styles.emptyTitle}>{node.data.label}</div>
                {project?.blueprint?.find(b => b.label === node.data.label)?.description && (
                  <div className={styles.emptyGoal}>
                    {project.blueprint!.find(b => b.label === node.data.label)!.description}
                  </div>
                )}
                {node.data.handoffDoc ? (
                  <div className={styles.emptyHandoff}>
                    <span className={styles.emptyHandoffLabel}>Last session</span>
                    <span>{node.data.handoffDoc.currentStatus}</span>
                    <span className={styles.emptyHandoffLabel}>Next steps</span>
                    <span>{node.data.handoffDoc.nextSteps}</span>
                  </div>
                ) : (
                  <div className={styles.emptyHint}>
                    First session. Copy context → paste into Claude Code to start.
                  </div>
                )}
              </div>
            )}

            {node.data.chatHistory.map(msg => (
              <div key={msg.id} className={`${styles.msg} ${styles[msg.role]}`}>
                <span className={styles.roleLabel}>{msg.role === 'user' ? 'you' : 'claude'}</span>
                <pre className={styles.msgContent}>{msg.content}</pre>
              </div>
            ))}

            {streaming && (
              <div className={`${styles.msg} ${styles.assistant}`}>
                <span className={styles.roleLabel}>claude</span>
                {streamBuffer ? (
                  <pre className={styles.msgContent}>{streamBuffer}<span className={styles.cursor}>▌</span></pre>
                ) : (
                  <span className={styles.thinking}>thinking...</span>
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
              placeholder="Ask Claude... (Enter to send, Shift+Enter for newline)"
              rows={3}
            />
            <button
              className={styles.sendBtn}
              onClick={send}
              disabled={streaming || !input.trim()}
            >
              {streaming ? '...' : 'Send'}
            </button>
          </div>
        </div>

        {/* ── Sidebar ── */}
        {sidebarOpen && (
          <div className={styles.sidebar}>
            <div className={styles.sidebarTabs}>
              {(['context', 'bugs', 'decisions'] as const).map(tab => (
                <button
                  key={tab}
                  className={`${styles.sidebarTab} ${sidebarTab === tab ? styles.sidebarTabActive : ''}`}
                  onClick={() => setSidebarTab(tab)}
                >
                  {tab === 'context' ? 'Context' : tab === 'bugs' ? `Bugs${bugs.length ? ` (${bugs.filter(b => b.status === 'open').length})` : ''}` : `Decisions${decisions.length ? ` (${decisions.length})` : ''}`}
                </button>
              ))}
            </div>

            <div className={styles.sidebarContent}>

              {/* Context tab */}
              {sidebarTab === 'context' && (
                <div className={styles.contextPanel}>
                  <div className={styles.contextDesc}>
                    Paste this at the start of your Claude Code session. Auto-updates each session.
                  </div>
                  <button className={styles.copyBtn} onClick={copyContext}>
                    {contextCopied ? 'Copied!' : 'Copy context'}
                  </button>
                  <pre className={styles.contextBlock}>{contextBlock}</pre>

                  {node.data.handoffDoc && (
                    <div className={styles.handoffPreview}>
                      <div className={styles.handoffPreviewTitle}>Last session handoff</div>
                      <div className={styles.handoffField}>
                        <span className={styles.handoffLabel}>Built</span>
                        <span>{node.data.handoffDoc.whatWasBuilt}</span>
                      </div>
                      <div className={styles.handoffField}>
                        <span className={styles.handoffLabel}>Status</span>
                        <span>{node.data.handoffDoc.currentStatus}</span>
                      </div>
                      <div className={styles.handoffField}>
                        <span className={styles.handoffLabel}>Next</span>
                        <span>{node.data.handoffDoc.nextSteps}</span>
                      </div>
                      {node.data.handoffDoc.filesChanged?.length > 0 && (
                        <div className={styles.handoffField}>
                          <span className={styles.handoffLabel}>Files</span>
                          <span className={styles.filesList}>
                            {node.data.handoffDoc.filesChanged.map(f => (
                              <code key={f} className={styles.fileChip}>{f}</code>
                            ))}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Bugs tab */}
              {sidebarTab === 'bugs' && (
                <div className={styles.bugsPanel}>
                  <button
                    className={styles.addBtn}
                    onClick={() => setShowBugForm(v => !v)}
                  >
                    {showBugForm ? 'Cancel' : '+ Log bug'}
                  </button>

                  {showBugForm && (
                    <div className={styles.inlineForm}>
                      <input
                        className={styles.formInput}
                        placeholder="Describe the bug..."
                        value={bugDesc}
                        onChange={e => setBugDesc(e.target.value)}
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && handleAddBug()}
                      />
                      <button className={styles.formSubmit} onClick={handleAddBug} disabled={!bugDesc.trim()}>
                        Log
                      </button>
                    </div>
                  )}

                  {bugs.length === 0 && !showBugForm && (
                    <div className={styles.emptyPanel}>No bugs logged for this section.</div>
                  )}

                  {bugs.map(bug => (
                    <div key={bug.id} className={`${styles.bugItem} ${bug.status === 'fixed' ? styles.bugFixed : ''}`}>
                      <div className={`${styles.bugDot} ${bug.status === 'fixed' ? styles.bugDotFixed : ''}`} />
                      <div className={styles.bugText}>
                        <span className={styles.bugDesc}>{bug.description}</span>
                        <span className={styles.bugStatus}>{bug.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Decisions tab */}
              {sidebarTab === 'decisions' && (
                <div className={styles.decisionsPanel}>
                  <div className={styles.decisionsDesc}>
                    Log decisions as you make them. They auto-inject into the context file.
                  </div>
                  <button
                    className={styles.addBtn}
                    onClick={() => setShowDecisionForm(v => !v)}
                  >
                    {showDecisionForm ? 'Cancel' : '+ Log decision'}
                  </button>

                  {showDecisionForm && (
                    <div className={styles.inlineForm}>
                      <input
                        className={styles.formInput}
                        placeholder="Decision (e.g. Use JWT for auth)"
                        value={decisionText}
                        onChange={e => setDecisionText(e.target.value)}
                        autoFocus
                      />
                      <input
                        className={styles.formInput}
                        placeholder="Reason (e.g. Simpler than sessions for our use case)"
                        value={decisionReason}
                        onChange={e => setDecisionReason(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddDecision()}
                      />
                      <button className={styles.formSubmit} onClick={handleAddDecision} disabled={!decisionText.trim() || !decisionReason.trim()}>
                        Log
                      </button>
                    </div>
                  )}

                  {decisions.length === 0 && !showDecisionForm && (
                    <div className={styles.emptyPanel}>No decisions logged yet.</div>
                  )}

                  {decisions.map(d => (
                    <div key={d.id} className={styles.decisionItem}>
                      <div className={styles.decisionDot} />
                      <div className={styles.decisionText}>
                        <span className={styles.decisionMain}>{d.decision}</span>
                        <span className={styles.decisionReason}>{d.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
