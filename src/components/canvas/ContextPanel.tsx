import { useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import { nanoid } from 'nanoid'

/**
 * ContextPanel — a lightweight floating panel on the canvas that shows
 * the project's Decision Log, Bugs, and ADRs at a glance.
 *
 * Opened/closed from the Toolbar. Stays on top of the canvas.
 */

interface Props {
  onClose: () => void
}

type SubTab = 'decisions' | 'bugs' | 'adrs'

export default function ContextPanel({ onClose }: Props) {
  const {
    project, nodes,
    addDecision, deleteDecision,
    addBug, fixBug, deleteBug,
    addAdr, deleteAdr,
  } = useWorkstationStore()

  const [tab, setTab] = useState<SubTab>('decisions')

  // Decision form
  const [showDecisionForm, setShowDecisionForm] = useState(false)
  const [decText, setDecText] = useState('')
  const [decReason, setDecReason] = useState('')
  const [decSection, setDecSection] = useState('')

  // Bug form
  const [showBugForm, setShowBugForm] = useState(false)
  const [bugDesc, setBugDesc] = useState('')
  const [bugSection, setBugSection] = useState('')

  // ADR form
  const [showAdrForm, setShowAdrForm] = useState(false)
  const [adrTitle, setAdrTitle] = useState('')
  const [adrDecision, setAdrDecision] = useState('')
  const [adrReason, setAdrReason] = useState('')

  const decisions = project?.decisions ?? []
  const bugs = project?.bugs ?? []
  const openBugs = bugs.filter(b => b.status === 'open')
  const adrs = project?.adrs ?? []
  const sectionNodes = nodes.filter(n => n.data?.kind === 'section')

  function handleAddDec() {
    if (!decText.trim()) return
    addDecision(decText.trim(), decReason.trim(), decSection)
    setDecText('')
    setDecReason('')
    setDecSection('')
    setShowDecisionForm(false)
  }

  function handleAddBug() {
    if (!bugDesc.trim()) return
    addBug(bugDesc.trim(), bugSection || 'general')
    setBugDesc('')
    setBugSection('')
    setShowBugForm(false)
  }

  function handleAddAdr() {
    if (!adrTitle.trim() || !adrDecision.trim() || !adrReason.trim()) return
    addAdr(adrTitle.trim(), adrDecision.trim(), adrReason.trim())
    setAdrTitle('')
    setAdrDecision('')
    setAdrReason('')
    setShowAdrForm(false)
  }

  const TABS: { id: SubTab; label: string; count?: number }[] = [
    { id: 'decisions', label: 'Decisions', count: decisions.length || undefined },
    { id: 'bugs',      label: 'Bugs',      count: openBugs.length || undefined },
    { id: 'adrs',      label: 'ADRs',      count: adrs.length || undefined },
  ]

  const STYLE = {
    panel: {
      position: 'fixed' as const,
      right: 420,
      top: 100,
      width: 380,
      maxHeight: 500,
      background: '#0b0b14',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
      zIndex: 8000,
      display: 'flex',
      flexDirection: 'column' as const,
      overflow: 'hidden',
      fontFamily: "'Inter', system-ui, sans-serif",
      fontSize: 12,
      color: '#e2e2f0',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      flexShrink: 0,
    },
    headerTitle: {
      fontSize: 12,
      fontWeight: 600,
      color: 'rgba(255,255,255,0.7)',
    },
    closeBtn: {
      background: 'none',
      border: 'none',
      color: 'rgba(255,255,255,0.2)',
      fontSize: 18,
      cursor: 'pointer',
      padding: '2px 6px',
      borderRadius: 4,
    },
    tabs: {
      display: 'flex',
      gap: 0,
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      flexShrink: 0,
    },
    tab: (active: boolean) => ({
      flex: 1,
      padding: '8px 12px',
      background: 'none',
      border: 'none',
      borderBottom: active ? '2px solid #00ff88' : '2px solid transparent',
      color: active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)',
      fontSize: 11,
      fontWeight: active ? 600 : 400,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    }),
    badge: (isBug?: boolean) => ({
      background: isBug ? 'rgba(255,68,102,0.15)' : 'rgba(0,255,136,0.1)',
      color: isBug ? '#ff4466' : '#00ff88',
      fontSize: 10,
      fontWeight: 700,
      padding: '1px 6px',
      borderRadius: 8,
      lineHeight: '16px',
    }),
    content: {
      flex: 1,
      overflowY: 'auto' as const,
      padding: 12,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 8,
    },
    addBtn: {
      background: 'rgba(0,255,136,0.08)',
      border: '1px solid rgba(0,255,136,0.15)',
      color: '#00ff88',
      padding: '6px 14px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      cursor: 'pointer',
      width: '100%',
    },
    empty: {
      color: 'rgba(255,255,255,0.15)',
      fontSize: 11,
      textAlign: 'center' as const,
      padding: '20px 0',
    },
    form: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 6,
      padding: '8px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    },
    formInput: {
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      color: '#e2e2f0',
      padding: '6px 10px',
      borderRadius: 6,
      fontSize: 11,
      fontFamily: "'Inter', sans-serif",
      outline: 'none',
    },
    formSubmit: {
      background: '#00ff88',
      color: '#000',
      border: 'none',
      padding: '5px 12px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      cursor: 'pointer',
      alignSelf: 'flex-end',
    },
    item: {
      display: 'flex',
      gap: 8,
      padding: '6px 8px',
      borderRadius: 6,
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.04)',
    },
    itemDot: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      marginTop: 5,
      flexShrink: 0,
    },
    itemBody: {
      flex: 1,
      minWidth: 0,
    },
    itemTitle: {
      fontSize: 11,
      fontWeight: 600,
      color: 'rgba(255,255,255,0.75)',
      marginBottom: 2,
    },
    itemMeta: {
      fontSize: 10,
      color: 'rgba(255,255,255,0.25)',
    },
    itemActions: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      flexShrink: 0,
    },
    iconBtn: {
      background: 'none',
      border: 'none',
      color: 'rgba(255,255,255,0.15)',
      fontSize: 14,
      cursor: 'pointer',
      padding: '2px 4px',
      borderRadius: 4,
    },
  }

  return (
    <div style={STYLE.panel}>
      {/* Header */}
      <div style={STYLE.header}>
        <span style={STYLE.headerTitle}>Context Log</span>
        <button style={STYLE.closeBtn} onClick={onClose}>×</button>
      </div>

      {/* Tabs */}
      <div style={STYLE.tabs}>
        {TABS.map(t => (
          <button key={t.id} style={STYLE.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span style={STYLE.badge(t.id === 'bugs')}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={STYLE.content}>
        {/* ── Decisions ── */}
        {tab === 'decisions' && (
          <>
            <button style={STYLE.addBtn} onClick={() => setShowDecisionForm(v => !v)}>
              {showDecisionForm ? 'Cancel' : '+ Log decision'}
            </button>

            {showDecisionForm && (
              <div style={STYLE.form}>
                <input
                  style={STYLE.formInput}
                  placeholder="What was decided"
                  value={decText}
                  onChange={e => setDecText(e.target.value)}
                  autoFocus
                />
                <input
                  style={STYLE.formInput}
                  placeholder="Why (the reason)"
                  value={decReason}
                  onChange={e => setDecReason(e.target.value)}
                />
                <select style={STYLE.formInput} value={decSection} onChange={e => setDecSection(e.target.value)}>
                  <option value="">Related section...</option>
                  {sectionNodes.map(n => (
                    <option key={n.id} value={n.data.label}>{n.data.label}</option>
                  ))}
                </select>
                <button style={STYLE.formSubmit} onClick={handleAddDec} disabled={!decText.trim()}>
                  Save
                </button>
              </div>
            )}

            {decisions.length === 0 && !showDecisionForm && (
              <div style={STYLE.empty}>No decisions logged yet.</div>
            )}

            {decisions.map(d => (
              <div key={d.id} style={STYLE.item}>
                <div style={{ ...STYLE.itemDot, background: '#7c9eff' }} />
                <div style={STYLE.itemBody}>
                  <div style={STYLE.itemTitle}>{d.decision}</div>
                  {d.reason && <div style={STYLE.itemMeta}>{d.reason}</div>}
                  {d.sectionId && <div style={{ ...STYLE.itemMeta, fontSize: 9, marginTop: 2 }}>
                    section: {nodes.find(n => n.id === d.sectionId)?.data.label ?? d.sectionId}
                  </div>}
                </div>
                <div style={STYLE.itemActions}>
                  <button style={STYLE.iconBtn} onClick={() => deleteDecision(d.id)}>✕</button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Bugs ── */}
        {tab === 'bugs' && (
          <>
            <button style={STYLE.addBtn} onClick={() => setShowBugForm(v => !v)}>
              {showBugForm ? 'Cancel' : '+ Log bug'}
            </button>

            {showBugForm && (
              <div style={STYLE.form}>
                <input
                  style={STYLE.formInput}
                  placeholder="Bug description"
                  value={bugDesc}
                  onChange={e => setBugDesc(e.target.value)}
                  autoFocus
                />
                <select style={STYLE.formInput} value={bugSection} onChange={e => setBugSection(e.target.value)}>
                  <option value="">Affected section...</option>
                  {sectionNodes.map(n => (
                    <option key={n.id} value={n.data.label}>{n.data.label}</option>
                  ))}
                  <option value="general">General</option>
                </select>
                <button style={STYLE.formSubmit} onClick={handleAddBug} disabled={!bugDesc.trim()}>
                  Log bug
                </button>
              </div>
            )}

            {openBugs.length === 0 && !showBugForm && (
              <div style={STYLE.empty}>No open bugs.</div>
            )}

            {openBugs.map(b => (
              <div key={b.id} style={STYLE.item}>
                <div style={{ ...STYLE.itemDot, background: '#ff4466' }} />
                <div style={STYLE.itemBody}>
                  <div style={STYLE.itemTitle}>{b.description}</div>
                  <div style={STYLE.itemMeta}>{b.affectedSection}</div>
                </div>
                <div style={STYLE.itemActions}>
                  <button style={{ ...STYLE.iconBtn, color: '#00ff88', fontSize: 11 }} onClick={() => fixBug(b.id)}>
                    ✓
                  </button>
                  <button style={STYLE.iconBtn} onClick={() => deleteBug(b.id)}>✕</button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── ADRs ── */}
        {tab === 'adrs' && (
          <>
            <button style={STYLE.addBtn} onClick={() => setShowAdrForm(v => !v)}>
              {showAdrForm ? 'Cancel' : '+ Add ADR'}
            </button>

            {showAdrForm && (
              <div style={STYLE.form}>
                <input
                  style={STYLE.formInput}
                  placeholder="Title (e.g. Use Supabase for auth)"
                  value={adrTitle}
                  onChange={e => setAdrTitle(e.target.value)}
                  autoFocus
                />
                <input
                  style={STYLE.formInput}
                  placeholder="Decision"
                  value={adrDecision}
                  onChange={e => setAdrDecision(e.target.value)}
                />
                <input
                  style={STYLE.formInput}
                  placeholder="Reason"
                  value={adrReason}
                  onChange={e => setAdrReason(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddAdr()}
                />
                <button style={STYLE.formSubmit} onClick={handleAddAdr} disabled={!adrTitle.trim() || !adrDecision.trim() || !adrReason.trim()}>
                  Save ADR
                </button>
              </div>
            )}

            {adrs.length === 0 && !showAdrForm && (
              <div style={STYLE.empty}>No ADRs recorded.</div>
            )}

            {adrs.map(a => (
              <div key={a.id} style={STYLE.item}>
                <div style={{ ...STYLE.itemDot, background: '#00ff88' }} />
                <div style={STYLE.itemBody}>
                  <div style={STYLE.itemTitle}>{a.title}</div>
                  <div style={STYLE.itemMeta}>{a.decision}</div>
                  <div style={{ ...STYLE.itemMeta, fontSize: 9, marginTop: 2 }}>{a.reason}</div>
                </div>
                <div style={STYLE.itemActions}>
                  <button style={STYLE.iconBtn} onClick={() => deleteAdr(a.id)}>✕</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
