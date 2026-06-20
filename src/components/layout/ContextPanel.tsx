import { useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './ContextPanel.module.css'

type Tab = 'decisions' | 'bugs' | 'adrs'

interface Props {
  onClose?: () => void
}

/**
 * ContextPanel — surfaces existing decisions, bugs, and ADRs from the store
 * in a collapsible right-side panel. Previously this data was only visible
 * in the WarRoom screen — now it's accessible during the build loop.
 */
export default function ContextPanel({ onClose }: Props) {
  const {
    project, nodes,
    addAdr, deleteAdr,
    addBug, fixBug, deleteBug,
    addDecision, deleteDecision,
  } = useWorkstationStore()

  const [tab, setTab] = useState<Tab>('decisions')

  // Forms
  const [showAdrForm, setShowAdrForm] = useState(false)
  const [adrTitle, setAdrTitle] = useState('')
  const [adrDecision, setAdrDecision] = useState('')
  const [adrReason, setAdrReason] = useState('')

  const [showBugForm, setShowBugForm] = useState(false)
  const [bugDesc, setBugDesc] = useState('')
  const [bugSection, setBugSection] = useState('')

  const decisions = project?.decisions ?? []
  const bugs = project?.bugs ?? []
  const openBugs = bugs.filter(b => b.status === 'open')
  const fixedBugs = bugs.filter(b => b.status === 'fixed')
  const adrs = project?.adrs ?? []

  const sections = nodes.filter(n => n.data?.kind === 'section')
  const overview = nodes.find(n => n.data?.kind === 'overview')

  function handleAddAdr() {
    if (!adrTitle.trim() || !adrDecision.trim() || !adrReason.trim()) return
    addAdr(adrTitle.trim(), adrDecision.trim(), adrReason.trim())
    setAdrTitle('')
    setAdrDecision('')
    setAdrReason('')
    setShowAdrForm(false)
  }

  function handleAddBug() {
    if (!bugDesc.trim() || !bugSection.trim()) return
    addBug(bugDesc.trim(), bugSection.trim())
    setBugDesc('')
    setBugSection('')
    setShowBugForm(false)
  }

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: 'decisions', label: 'Decisions', badge: decisions.length || undefined },
    { id: 'bugs',      label: 'Bugs',      badge: openBugs.length || undefined },
    { id: 'adrs',      label: 'ADRs',      badge: adrs.length || undefined },
  ]

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.headerIcon}>⊛</span>
        <span className={styles.headerTitle}>Context</span>
        {onClose && (
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className={`${styles.badge} ${t.id === 'bugs' && openBugs.length > 0 ? styles.badgeBug : ''}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={styles.content}>
        {!project && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>⊛</div>
            <div className={styles.emptyText}>No project open</div>
            <div className={styles.emptyHint}>Open a project on the Dashboard to see context</div>
          </div>
        )}

        {/* ── Decisions ── */}
        {project && tab === 'decisions' && (
          <div className={styles.listPanel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelMeta}>
                Decisions are injected into Claude session context automatically.
              </span>
              <button
                className={styles.addBtn}
                onClick={() => {
                  // Quick-add: save current active section's conversation as a decision
                  const state = useWorkstationStore.getState()
                  const activeNode = state.activeNodeId
                    ? state.nodes.find(n => n.id === state.activeNodeId)
                    : null
                  if (activeNode && state.project) {
                    const recent = activeNode.data.chatHistory?.slice(-1)?.[0]
                    if (recent) {
                      addDecision(
                        recent.content.slice(0, 200),
                        'Logged from session',
                        activeNode.data.label
                      )
                    }
                  }
                }}
                title="Log last message as decision"
              >
                + From chat
              </button>
            </div>

            {decisions.length === 0 && (
              <div className={styles.empty}>
                <div className={styles.emptyText}>No decisions logged yet</div>
                <div className={styles.emptyHint}>
                  Decisions are logged automatically at session end,
                  or click "+ From chat" to save something from the current conversation.
                </div>
              </div>
            )}

            {decisions.slice().reverse().map(d => (
              <div key={d.id} className={styles.row}>
                <div className={styles.rowDot} />
                <div className={styles.rowInfo}>
                  <div className={styles.rowTitle}>{d.decision}</div>
                  <div className={styles.rowMeta}>
                    {d.reason}
                    {d.sectionId && ` · ${d.sectionId}`}
                  </div>
                </div>
                <button className={styles.deleteBtn} onClick={() => deleteDecision(d.id)}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* ── Bugs ── */}
        {project && tab === 'bugs' && (
          <div className={styles.listPanel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelMeta}>
                {openBugs.length} open · {fixedBugs.length} fixed
              </span>
              <button className={styles.addBtn} onClick={() => setShowBugForm(v => !v)}>
                {showBugForm ? 'Cancel' : '+ Bug'}
              </button>
            </div>

            {showBugForm && (
              <div className={styles.form}>
                <input
                  className={styles.formInput}
                  placeholder="Bug description…"
                  value={bugDesc}
                  onChange={e => setBugDesc(e.target.value)}
                  autoFocus
                />
                <select
                  className={styles.formInput}
                  value={bugSection}
                  onChange={e => setBugSection(e.target.value)}
                >
                  <option value="">Affected section…</option>
                  {sections.map(n => (
                    <option key={n.id} value={n.data.label as string}>{n.data.label as string}</option>
                  ))}
                  <option value="general">General</option>
                </select>
                <div className={styles.formActions}>
                  <button className={styles.formSubmit} onClick={handleAddBug} disabled={!bugDesc.trim() || !bugSection.trim()}>
                    Log bug
                  </button>
                </div>
              </div>
            )}

            {bugs.length === 0 && !showBugForm && (
              <div className={styles.empty}>
                <div className={styles.emptyText}>No bugs logged</div>
              </div>
            )}

            {openBugs.length > 0 && (
              <div className={styles.group}>
                <div className={styles.groupLabel}>Open</div>
                {openBugs.map(b => (
                  <div key={b.id} className={styles.row}>
                    <div className={styles.bugDot} />
                    <div className={styles.rowInfo}>
                      <div className={styles.rowTitle}>{b.description}</div>
                      <div className={styles.rowMeta}>{b.affectedSection}</div>
                    </div>
                    <div className={styles.rowActions}>
                      <button className={styles.fixBtn} onClick={() => fixBug(b.id)}>Fix</button>
                      <button className={styles.deleteBtn} onClick={() => deleteBug(b.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {fixedBugs.length > 0 && (
              <div className={styles.group}>
                <div className={styles.groupLabel}>Fixed</div>
                {fixedBugs.map(b => (
                  <div key={b.id} className={`${styles.row} ${styles.rowFixed}`}>
                    <div className={`${styles.bugDot} ${styles.bugDotFixed}`} />
                    <div className={styles.rowInfo}>
                      <div className={styles.rowTitle}>{b.description}</div>
                      <div className={styles.rowMeta}>{b.affectedSection}</div>
                    </div>
                    <button className={styles.deleteBtn} onClick={() => deleteBug(b.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ADRs ── */}
        {project && tab === 'adrs' && (
          <div className={styles.listPanel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelMeta}>
                Architecture decisions are injected into every Claude session context.
              </span>
              <button className={styles.addBtn} onClick={() => setShowAdrForm(v => !v)}>
                {showAdrForm ? 'Cancel' : '+ ADR'}
              </button>
            </div>

            {showAdrForm && (
              <div className={styles.form}>
                <input
                  className={styles.formInput}
                  placeholder="Title (e.g. Use Supabase for auth)"
                  value={adrTitle}
                  onChange={e => setAdrTitle(e.target.value)}
                  autoFocus
                />
                <input
                  className={styles.formInput}
                  placeholder="What was decided"
                  value={adrDecision}
                  onChange={e => setAdrDecision(e.target.value)}
                />
                <input
                  className={styles.formInput}
                  placeholder="Why (the reason)"
                  value={adrReason}
                  onChange={e => setAdrReason(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddAdr()}
                />
                <div className={styles.formActions}>
                  <button className={styles.formSubmit} onClick={handleAddAdr} disabled={!adrTitle.trim() || !adrDecision.trim() || !adrReason.trim()}>
                    Save
                  </button>
                </div>
              </div>
            )}

            {adrs.length === 0 && !showAdrForm && (
              <div className={styles.empty}>
                <div className={styles.emptyText}>No architecture decisions recorded</div>
                <div className={styles.emptyHint}>
                  ADRs are included in every Claude session prompt — they help Claude understand your architecture choices.
                </div>
              </div>
            )}

            {adrs.slice().reverse().map(adr => (
              <div key={adr.id} className={styles.row}>
                <div className={styles.adrDot} />
                <div className={styles.rowInfo}>
                  <div className={styles.rowTitle}>{adr.title}</div>
                  <div className={styles.rowDecision}>{adr.decision}</div>
                  <div className={styles.rowReason}>{adr.reason}</div>
                </div>
                <button className={styles.deleteBtn} onClick={() => deleteAdr(adr.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
