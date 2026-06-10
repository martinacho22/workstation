import { useState, useRef, useEffect } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import { streamClaude } from '@/lib/claudeRunner'
import { ChatMessage, SessionPresetKind } from '@/types'
import { SESSION_PRESETS, inferPresetKind } from '@/lib/sessionPresets'
import { nanoid } from 'nanoid'
import styles from './SessionView.module.css'

// ─── Token estimation ─────────────────────────────────────────────────────────
// Rough: 4 chars ≈ 1 token. We also account for system prompt (~400 tokens)
// and the context block (~300 tokens) that get sent with every message.
const OVERHEAD_TOKENS = 700

function estimateTokens(messages: ChatMessage[]): number {
  const historyChars = messages.reduce((sum, m) => sum + m.content.length, 0)
  return Math.ceil(historyChars / 4) + OVERHEAD_TOKENS
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SessionView() {
  const {
    activeNodeId, nodes, project,
    addChatMessage, endSession, sessionLoading,
    generateContextBlock, addBug, addDecision,
    updateNodeStatus,
  } = useWorkstationStore()

  const node = nodes.find(n => n.id === activeNodeId)

  const [input, setInput]                   = useState('')
  const [streaming, setStreaming]           = useState(false)
  const [streamBuffer, setStreamBuffer]     = useState('')
  const [sidebarTab, setSidebarTab]         = useState<'context' | 'bugs' | 'decisions'>('context')
  const [sidebarOpen, setSidebarOpen]       = useState(true)
  const [contextCopied, setContextCopied]   = useState(false)
  const [endingSession, setEndingSession]   = useState(false)
  const [presetKind, setPresetKind]         = useState<SessionPresetKind>(() =>
    inferPresetKind(node?.data.label ?? '')
  )
  const [launchingCode, setLaunchingCode]   = useState(false)
  const [codeLaunched, setCodeLaunched]     = useState(false)

  // Bug form
  const [bugDesc, setBugDesc]             = useState('')
  const [showBugForm, setShowBugForm]     = useState(false)

  // Decision form
  const [decisionText, setDecisionText]   = useState('')
  const [decisionReason, setDecisionReason] = useState('')
  const [showDecisionForm, setShowDecisionForm] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [node?.data.chatHistory, streamBuffer])

  useEffect(() => {
    inputRef.current?.focus()
  }, [activeNodeId])

  // Reset preset kind if node changes
  useEffect(() => {
    if (node) setPresetKind(inferPresetKind(node.data.label))
    setCodeLaunched(false)
  }, [activeNodeId])

  if (!node) return null

  const contextBlock = generateContextBlock(node.id)
  const bugs         = (project?.bugs ?? []).filter(b => b.affectedSection === node.data.label)
  const decisions    = (project?.decisions ?? []).filter(d => d.sectionId === node.data.label)

  // Token estimation with overhead
  const estimatedTokens = estimateTokens(node.data.chatHistory)
  const contextZone =
    estimatedTokens < 40000 ? 'green' :
    estimatedTokens < 80000 ? 'yellow' : 'red'
  const tokenDisplay = estimatedTokens > 1000
    ? `~${Math.round(estimatedTokens / 1000)}k`
    : `~${estimatedTokens}`

  // ── Claude Code launcher ──────────────────────────────────────────────────

  async function launchClaudeCode() {
    setLaunchingCode(true)
    try {
      const electronAPI = (window as any).electron
      if (!electronAPI?.terminal?.create) return

      const preset = SESSION_PRESETS[presetKind]
      const blueprint = project?.blueprint?.find(b => b.label === node.data.label)

      const bootPrompt = preset.bootPrompt({
        projectName:   project?.name ?? 'this project',
        sectionLabel:  node.data.label,
        sectionGoal:   blueprint?.description ?? node.data.label,
        stack:         project?.stack ?? '',
        handoffSummary: node.data.handoffDoc
          ? `${node.data.handoffDoc.currentStatus}. Next: ${node.data.handoffDoc.nextSteps}`
          : undefined,
        projectDir: project?.projectDir ?? project?.repoPath ?? '.',
      })

      // Determine working directory: projectDir > repoPath > home
      const cwd = project?.projectDir ?? project?.repoPath ?? undefined

      const terminalId = nanoid(6)
      await electronAPI.terminal.create({
        id:              terminalId,
        shell:           'claude',
        skipPermissions: true,
        cwd,
        presetPrompt:    bootPrompt,
      })

      setCodeLaunched(true)

      // Log it as an assistant message so the user knows what was sent
      addChatMessage(node.id, {
        id:        nanoid(),
        role:      'assistant',
        content:   `Claude Code launched in ${cwd ?? 'home directory'}.\n\nPreset: **${preset.label}**\nSent on boot:\n\n${bootPrompt}`,
        timestamp: Date.now(),
      })
    } catch (err) {
      addChatMessage(node.id, {
        id:        nanoid(),
        role:      'assistant',
        content:   `Failed to launch Claude Code: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      })
    } finally {
      setLaunchingCode(false)
    }
  }

  // ── Context copy ──────────────────────────────────────────────────────────

  function copyContext() {
    navigator.clipboard.writeText(contextBlock)
    setContextCopied(true)
    setTimeout(() => setContextCopied(false), 1500)
  }

  // ── Planning chat send ────────────────────────────────────────────────────

  async function send() {
    if (!input.trim() || streaming) return

    const userMsg: ChatMessage = {
      id:        nanoid(),
      role:      'user',
      content:   input.trim(),
      timestamp: Date.now(),
    }
    addChatMessage(node.id, userMsg)
    setInput('')
    setStreaming(true)
    setStreamBuffer('')

    const blueprint   = project?.blueprint?.find(b => b.label === node.data.label)
    const systemPrompt = [
      `You are a senior developer planning companion for the section "${node.data.label}".`,
      project ? `Project: ${project.name}. Stack: ${project.stack}.` : '',
      blueprint?.description ? `Section goal: ${blueprint.description}` : '',
      node.data.handoffDoc
        ? `Last session: ${node.data.handoffDoc.currentStatus}. Next: ${node.data.handoffDoc.nextSteps}`
        : 'This is the first session in this section.',
      `This chat is for planning and decision-making. The actual code runs in Claude Code (separate terminal).`,
      `Be concise. Think step by step. Ask before suggesting large structural changes.`,
    ].filter(Boolean).join('\n')

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
        id:        nanoid(),
        role:      'assistant',
        content:   fullText || accumulated,
        timestamp: Date.now(),
      })
    } catch (err) {
      setStreamBuffer('')
      addChatMessage(node.id, {
        id:        nanoid(),
        role:      'assistant',
        content:   `Error: ${err instanceof Error ? err.message : 'Unknown error'}. Is Claude CLI connected?`,
        timestamp: Date.now(),
      })
    } finally {
      setStreaming(false)
    }
  }

  // ── End session ───────────────────────────────────────────────────────────

  async function handleEndSession() {
    setEndingSession(true)
    await endSession(node.id)
    setEndingSession(false)
  }

  // ── Bug / decision forms ──────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.session}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            className={styles.backBtn}
            onClick={() => useWorkstationStore.getState().setActiveNode(null)}
            title="Back to canvas"
          >
            ←
          </button>
          <span className={styles.projectCrumb}>{project?.name ?? 'Project'}</span>
          <span className={styles.crumbSep}>/</span>
          <span className={styles.sectionCrumb}>{node.data.label}</span>

          {/* Node status badge */}
          <span className={`${styles.statusBadge} ${styles[`status_${node.data.status}`]}`}>
            {node.data.status}
          </span>
        </div>

        <div className={styles.headerCenter}>
          {/* Context health meter */}
          <div className={`${styles.tokenMeter} ${styles[contextZone]}`}>
            <span className={styles.tokenDot} />
            <span className={styles.tokenLabel}>{tokenDisplay} ctx</span>
            {contextZone === 'yellow' && <span className={styles.tokenWarn}>filling up</span>}
            {contextZone === 'red'    && <span className={styles.tokenWarn}>start fresh</span>}
          </div>
        </div>

        <div className={styles.headerRight}>
          <button
            className={styles.sidebarToggle}
            onClick={() => setSidebarOpen(o => !o)}
          >
            {sidebarOpen ? 'Hide panel' : 'Show panel'}
          </button>

          <button
            className={`${styles.statusBtn} ${node.data.status === 'done' ? styles.statusDone : ''}`}
            onClick={() => updateNodeStatus(node.id, node.data.status === 'done' ? 'active' : 'done')}
          >
            {node.data.status === 'done' ? 'Reopen' : 'Mark done'}
          </button>

          <button
            className={styles.endBtn}
            onClick={handleEndSession}
            disabled={endingSession || sessionLoading}
          >
            {endingSession ? 'Saving...' : 'End session'}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>

        {/* ── Planning chat ── */}
        <div className={styles.chatArea}>

          {/* Chat label */}
          <div className={styles.chatLabel}>
            Planning companion
            <span className={styles.chatLabelSub}>
              Think through the approach here. Code runs in Claude Code below.
            </span>
          </div>

          <div className={styles.messages}>
            {node.data.chatHistory.length === 0 && !streaming && (
              <div className={styles.emptyState}>
                <div className={styles.emptyTitle}>{node.data.label}</div>
                {project?.blueprint?.find(b => b.label === node.data.label)?.description && (
                  <div className={styles.emptyGoal}>
                    {project!.blueprint!.find(b => b.label === node.data.label)!.description}
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
                    First session. Launch Claude Code below to start working, or ask a planning question here.
                  </div>
                )}
              </div>
            )}

            {node.data.chatHistory.map(msg => (
              <div key={msg.id} className={`${styles.msg} ${styles[msg.role]}`}>
                <span className={styles.roleLabel}>
                  {msg.role === 'user' ? 'You' : 'Claude'}
                </span>
                <div className={styles.msgContent}>
                  {msg.content.split('\n').map((line, i) => (
                    <p key={i} className={line.startsWith('    ') || line.startsWith('\t') ? styles.codeLine : styles.textLine}>
                      {line || <br />}
                    </p>
                  ))}
                </div>
              </div>
            ))}

            {streaming && (
              <div className={`${styles.msg} ${styles.assistant}`}>
                <span className={styles.roleLabel}>Claude</span>
                {streamBuffer ? (
                  <div className={styles.msgContent}>
                    <p>{streamBuffer}<span className={styles.cursor}>▌</span></p>
                  </div>
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
              placeholder="Ask a planning question... (Enter to send, Shift+Enter for newline)"
              rows={2}
            />
            <button
              className={styles.sendBtn}
              onClick={send}
              disabled={streaming || !input.trim()}
            >
              {streaming ? '···' : 'Send'}
            </button>
          </div>

          {/* ── Claude Code launcher ── */}
          <div className={styles.launchBar}>
            <div className={styles.launchLabel}>
              Launch Claude Code
              <span className={styles.launchSub}>
                Opens in <code>{project?.projectDir ?? project?.repoPath ?? '~'}</code>
              </span>
            </div>

            <div className={styles.launchControls}>
              <select
                className={styles.presetSelect}
                value={presetKind}
                onChange={e => setPresetKind(e.target.value as SessionPresetKind)}
              >
                {Object.values(SESSION_PRESETS).map(p => (
                  <option key={p.kind} value={p.kind}>
                    {p.label} — {p.description}
                  </option>
                ))}
              </select>

              <button
                className={`${styles.launchBtn} ${codeLaunched ? styles.launchBtnDone : ''}`}
                onClick={launchClaudeCode}
                disabled={launchingCode}
              >
                {launchingCode ? 'Launching...' : codeLaunched ? 'Launched ✓' : 'Launch'}
              </button>
            </div>
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
                  {tab === 'context'
                    ? 'Context'
                    : tab === 'bugs'
                      ? `Bugs${bugs.filter(b => b.status === 'open').length ? ` · ${bugs.filter(b => b.status === 'open').length}` : ''}`
                      : `Decisions${decisions.length ? ` · ${decisions.length}` : ''}`}
                </button>
              ))}
            </div>

            <div className={styles.sidebarContent}>

              {/* ── Context tab ── */}
              {sidebarTab === 'context' && (
                <div className={styles.contextPanel}>
                  <div className={styles.contextDesc}>
                    This block is auto-sent when you launch Claude Code. It tells Claude exactly where it is and what it's building.
                  </div>
                  <button className={styles.copyBtn} onClick={copyContext}>
                    {contextCopied ? 'Copied!' : 'Copy context block'}
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

              {/* ── Bugs tab ── */}
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

              {/* ── Decisions tab ── */}
              {sidebarTab === 'decisions' && (
                <div className={styles.decisionsPanel}>
                  <div className={styles.decisionsDesc}>
                    Log decisions as you make them. They auto-inject into the context block.
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
