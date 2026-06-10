import { useState, useRef, useEffect } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import { streamClaude } from '@/lib/claudeRunner'
import { ChatMessage, SessionPresetKind } from '@/types'
import { SESSION_PRESETS, inferPresetKind } from '@/lib/sessionPresets'
import { nanoid } from 'nanoid'
import styles from './NodeWorkspace.module.css'

/**
 * NodeWorkspace — opens as an inline panel anchored to the bottom of the
 * canvas area when a node is selected. No navigation away from the canvas.
 *
 * Layout:
 *   [ Terminal / Claude Code launcher (left) | Planning chat (right) ]
 *
 * The canvas remains visible and interactive above this panel.
 */

const OVERHEAD_TOKENS = 700
function estimateTokens(messages: ChatMessage[]): number {
  const chars = messages.reduce((s, m) => s + m.content.length, 0)
  return Math.ceil(chars / 4) + OVERHEAD_TOKENS
}

export default function NodeWorkspace() {
  const {
    activeNodeId, nodes, project,
    addChatMessage, endSession, sessionLoading,
    generateContextBlock, addBug, addDecision,
    updateNodeStatus, setActiveNode,
  } = useWorkstationStore()

  const node = nodes.find(n => n.id === activeNodeId)

  const [input, setInput]                 = useState('')
  const [streaming, setStreaming]         = useState(false)
  const [streamBuffer, setStreamBuffer]   = useState('')
  const [tab, setTab]                     = useState<'context' | 'bugs' | 'decisions'>('context')
  const [contextCopied, setContextCopied] = useState(false)
  const [endingSession, setEndingSession] = useState(false)
  const [presetKind, setPresetKind]       = useState<SessionPresetKind>(() =>
    inferPresetKind(node?.data.label ?? ''))
  const [launchingCode, setLaunchingCode] = useState(false)
  const [codeLaunched, setCodeLaunched]   = useState(false)
  const [bugDesc, setBugDesc]             = useState('')
  const [showBugForm, setShowBugForm]     = useState(false)
  const [decisionText, setDecisionText]   = useState('')
  const [decisionReason, setDecisionReason] = useState('')
  const [showDecisionForm, setShowDecisionForm] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [node?.data.chatHistory, streamBuffer])

  useEffect(() => {
    if (node) setPresetKind(inferPresetKind(node.data.label))
    setCodeLaunched(false)
    inputRef.current?.focus()
  }, [activeNodeId])

  if (!node) return null

  const contextBlock = generateContextBlock(node.id)
  const bugs         = (project?.bugs ?? []).filter(b => b.affectedSection === node.data.label)
  const decisions    = (project?.decisions ?? []).filter(d => d.sectionId === node.data.label)

  const estimatedTokens = estimateTokens(node.data.chatHistory)
  const contextZone =
    estimatedTokens < 40000 ? 'green' :
    estimatedTokens < 80000 ? 'yellow' : 'red'
  const tokenDisplay = estimatedTokens > 1000
    ? `~${Math.round(estimatedTokens / 1000)}k`
    : `~${estimatedTokens}`

  // ── Launch Claude Code ────────────────────────────────────────────────────

  async function launchClaudeCode() {
    setLaunchingCode(true)
    try {
      const electronAPI = (window as any).electron
      if (!electronAPI?.terminal?.create) return

      const preset    = SESSION_PRESETS[presetKind]
      const blueprint = project?.blueprint?.find(b => b.label === node.data.label)

      const bootPrompt = preset.bootPrompt({
        projectName:    project?.name ?? 'this project',
        sectionLabel:   node.data.label,
        sectionGoal:    blueprint?.description ?? node.data.label,
        stack:          project?.stack ?? '',
        handoffSummary: node.data.handoffDoc
          ? `${node.data.handoffDoc.currentStatus}. Next: ${node.data.handoffDoc.nextSteps}`
          : undefined,
        projectDir: project?.projectDir ?? project?.repoPath ?? '.',
      })

      const cwd = project?.projectDir ?? project?.repoPath ?? undefined

      await electronAPI.terminal.create({
        id:              nanoid(6),
        shell:           'claude',
        skipPermissions: true,
        cwd,
        presetPrompt:    bootPrompt,
      })

      setCodeLaunched(true)

      addChatMessage(node.id, {
        id:        nanoid(),
        role:      'assistant',
        content:   `Claude Code launched in \`${cwd ?? '~'}\`.\n\nPreset: **${preset.label}**\n\n${bootPrompt}`,
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

  function copyContext() {
    navigator.clipboard.writeText(contextBlock)
    setContextCopied(true)
    setTimeout(() => setContextCopied(false), 1500)
  }

  // ── Planning chat ─────────────────────────────────────────────────────────

  async function send() {
    if (!input.trim() || streaming) return
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
      `This chat is for planning and thinking. Actual code runs in Claude Code (left panel).`,
      `Be concise. Ask before large structural changes.`,
    ].filter(Boolean).join('\n')

    const histCtx = node.data.chatHistory.slice(-10)
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
    } catch (err) {
      setStreamBuffer('')
      addChatMessage(node.id, {
        id: nanoid(), role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Unknown'}. Is Claude CLI connected?`,
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

  const statusColor =
    node.data.status === 'done'    ? 'rgba(74,222,128,0.8)' :
    node.data.status === 'active'  ? 'var(--accent)' :
    node.data.status === 'blocked' ? 'rgba(240,192,64,0.8)' :
    'rgba(255,255,255,0.3)'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.workspace}>

      {/* ── Header bar ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {/* Close — returns focus to canvas without navigating away */}
          <button
            className={styles.closeBtn}
            onClick={() => setActiveNode(null)}
            title="Close workspace (ESC)"
          >
            ╱╲
          </button>
          <span className={styles.nodeLabel}>{node.data.label}</span>
          <span
            className={styles.statusBadge}
            style={{ color: statusColor, borderColor: statusColor + '44', background: statusColor + '11' }}
          >
            {node.data.status}
          </span>
          {project?.blueprint?.find(b => b.label === node.data.label)?.description && (
            <span className={styles.nodeDesc}>
              {project!.blueprint!.find(b => b.label === node.data.label)!.description}
            </span>
          )}
        </div>

        <div className={styles.headerRight}>
          {/* Token health */}
          <div className={`${styles.tokenMeter} ${styles[contextZone]}`}>
            <span className={styles.tokenDot} />
            <span>{tokenDisplay} ctx</span>
            {contextZone !== 'green' && (
              <span className={styles.tokenWarn}>
                {contextZone === 'yellow' ? 'filling up' : 'start fresh'}
              </span>
            )}
          </div>

          <button
            className={`${styles.actionBtn} ${node.data.status === 'done' ? styles.actionBtnDone : ''}`}
            onClick={() => updateNodeStatus(node.id, node.data.status === 'done' ? 'active' : 'done')}
          >
            {node.data.status === 'done' ? 'Reopen' : 'Mark done'}
          </button>

          <button
            className={styles.endBtn}
            onClick={handleEndSession}
            disabled={endingSession || sessionLoading}
          >
            {endingSession ? 'Saving…' : 'End session'}
          </button>
        </div>
      </div>

      {/* ── Split body: terminal left | chat right ── */}
      <div className={styles.body}>

        {/* ── LEFT: Claude Code launcher ── */}
        <div className={styles.terminalPane}>
          <div className={styles.paneHeader}>
            <span className={styles.paneTitle}>Claude Code</span>
            <span className={styles.paneSub}>
              {project?.projectDir ?? project?.repoPath ?? '~'}
            </span>
          </div>

          <div className={styles.presetArea}>
            <div className={styles.presetLabel}>Session type</div>
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
              {launchingCode ? 'Launching…' : codeLaunched ? '✓ Launched' : 'Launch Claude Code'}
            </button>

            {codeLaunched && (
              <div className={styles.launchedNote}>
                Claude Code is running in <code>{project?.projectDir ?? '~'}</code>.
                The boot prompt has been sent.
              </div>
            )}
          </div>

          {/* Context block — always visible here, no hidden tab */}
          <div className={styles.contextSection}>
            <div className={styles.contextHeader}>
              <span className={styles.contextTitle}>Boot context</span>
              <button className={styles.copyBtn} onClick={copyContext}>
                {contextCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className={styles.contextBlock}>{contextBlock}</pre>
          </div>

          {/* Handoff from last session */}
          {node.data.handoffDoc && (
            <div className={styles.handoff}>
              <div className={styles.handoffTitle}>Last session</div>
              <div className={styles.handoffRow}>
                <span className={styles.handoffKey}>Built</span>
                <span className={styles.handoffVal}>{node.data.handoffDoc.whatWasBuilt}</span>
              </div>
              <div className={styles.handoffRow}>
                <span className={styles.handoffKey}>Next</span>
                <span className={styles.handoffVal}>{node.data.handoffDoc.nextSteps}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: planning chat + quick log tabs ── */}
        <div className={styles.chatPane}>

          {/* Tabs: chat | bugs | decisions */}
          <div className={styles.tabs}>
            {(['chat', 'bugs', 'decisions'] as const).map(t => (
              <button
                key={t}
                className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
                onClick={() => setTab(t as any)}
              >
                {t === 'chat'
                  ? 'Planning'
                  : t === 'bugs'
                    ? `Bugs${bugs.filter(b => b.status === 'open').length ? ` · ${bugs.filter(b => b.status === 'open').length}` : ''}`
                    : `Decisions${decisions.length ? ` · ${decisions.length}` : ''}`}
              </button>
            ))}
          </div>

          {/* ── Chat tab ── */}
          {tab === 'chat' && (
            <>
              <div className={styles.messages}>
                {node.data.chatHistory.length === 0 && !streaming && (
                  <div className={styles.emptyChat}>
                    <div className={styles.emptyChatTitle}>{node.data.label}</div>
                    {project?.blueprint?.find(b => b.label === node.data.label)?.description && (
                      <div className={styles.emptyChatGoal}>
                        {project!.blueprint!.find(b => b.label === node.data.label)!.description}
                      </div>
                    )}
                    <div className={styles.emptyChatHint}>
                      {node.data.handoffDoc
                        ? `Continuing from: ${node.data.handoffDoc.currentStatus}`
                        : 'Launch Claude Code on the left to start, or ask a planning question here.'}
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
                        <p key={i} className={
                          line.startsWith('    ') || line.startsWith('\t')
                            ? styles.codeLine : styles.textLine
                        }>
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

              <div className={styles.inputArea}>
                <textarea
                  ref={inputRef}
                  className={styles.input}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
                  }}
                  placeholder="Ask a planning question… (Enter to send)"
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
            </>
          )}

          {/* ── Bugs tab ── */}
          {tab === 'bugs' && (
            <div className={styles.logPanel}>
              <button className={styles.addBtn} onClick={() => setShowBugForm(v => !v)}>
                {showBugForm ? 'Cancel' : '+ Log bug'}
              </button>
              {showBugForm && (
                <div className={styles.inlineForm}>
                  <input
                    className={styles.formInput}
                    placeholder="Describe the bug…"
                    value={bugDesc}
                    autoFocus
                    onChange={e => setBugDesc(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddBug()}
                  />
                  <button className={styles.formSubmit} onClick={handleAddBug} disabled={!bugDesc.trim()}>
                    Log
                  </button>
                </div>
              )}
              {bugs.length === 0 && !showBugForm && (
                <div className={styles.emptyLog}>No bugs logged for this section.</div>
              )}
              {bugs.map(bug => (
                <div key={bug.id} className={`${styles.logItem} ${bug.status === 'fixed' ? styles.logItemDone : ''}`}>
                  <span className={styles.logDot} style={{ background: bug.status === 'fixed' ? '#4ade80' : '#f87171' }} />
                  <div>
                    <div className={styles.logMain}>{bug.description}</div>
                    <div className={styles.logMeta}>{bug.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Decisions tab ── */}
          {tab === 'decisions' && (
            <div className={styles.logPanel}>
              <button className={styles.addBtn} onClick={() => setShowDecisionForm(v => !v)}>
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
                    placeholder="Reason"
                    value={decisionReason}
                    onChange={e => setDecisionReason(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddDecision()}
                  />
                  <button className={styles.formSubmit} onClick={handleAddDecision}
                    disabled={!decisionText.trim() || !decisionReason.trim()}>
                    Log
                  </button>
                </div>
              )}
              {decisions.length === 0 && !showDecisionForm && (
                <div className={styles.emptyLog}>No decisions logged yet.</div>
              )}
              {decisions.map(d => (
                <div key={d.id} className={styles.logItem}>
                  <span className={styles.logDot} style={{ background: 'var(--accent)', opacity: 0.5 }} />
                  <div>
                    <div className={styles.logMain}>{d.decision}</div>
                    <div className={styles.logMeta}>{d.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
