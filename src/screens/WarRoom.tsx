import { useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './WarRoom.module.css'

type Tab = 'status' | 'bugs' | 'adrs' | 'export'

export default function WarRoom() {
  const {
    project, nodes,
    addAdr, deleteAdr,
    addBug, fixBug, deleteBug,
    exportHandoff,
  } = useWorkstationStore()

  const [tab, setTab] = useState<Tab>('status')
  const [copied, setCopied] = useState(false)

  // Bug form
  const [bugDesc, setBugDesc] = useState('')
  const [bugSection, setBugSection] = useState('')
  const [showBugForm, setShowBugForm] = useState(false)

  // ADR form
  const [adrTitle, setAdrTitle] = useState('')
  const [adrDecision, setAdrDecision] = useState('')
  const [adrReason, setAdrReason] = useState('')
  const [showAdrForm, setShowAdrForm] = useState(false)

  const sections = nodes.filter(n => n.data?.kind === 'section')
  const done = sections.filter(n => n.data?.status === 'done').length
  const blocked = sections.filter(n => n.data?.status === 'blocked').length
  const total = sections.length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  const bugs = project?.bugs ?? []
  const openBugs = bugs.filter(b => b.status === 'open')
  const fixedBugs = bugs.filter(b => b.status === 'fixed')
  const adrs = project?.adrs ?? []

  function handleAddBug() {
    if (!bugDesc.trim() || !bugSection.trim()) return
    addBug(bugDesc.trim(), bugSection.trim())
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

  function handleExport() {
    const md = exportHandoff()
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: 'status', label: 'Status' },
    { id: 'bugs',   label: 'Bugs',      badge: openBugs.length || undefined },
    { id: 'adrs',   label: 'Decisions', badge: adrs.length || undefined },
    { id: 'export', label: 'Export' },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{project?.name ?? 'No project'}</h1>
          <p className={styles.subtitle}>{project?.stack ?? ''}</p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <span className={styles.progressLabel}>{progress}% · {done}/{total} done{blocked > 0 ? ` · ${blocked} blocked` : ''}</span>
        </div>
      </div>

      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className={`${styles.badge} ${t.id === 'bugs' ? styles.badgeBug : ''}`}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      <div className={styles.content}>

        {/* ── Status ── */}
        {tab === 'status' && (
          <div className={styles.statusGrid}>
            {sections.length === 0 && (
              <div className={styles.empty}>No sections yet — go to the canvas to build your project plan.</div>
            )}
            {sections.map(n => {
              const desc = project?.blueprint?.find(b => b.label === n.data?.label)?.description
              const hasHandoff = !!n.data?.handoffDoc
              const msgCount = n.data?.chatHistory?.length ?? 0
              return (
                <div key={n.id} className={`${styles.sectionRow} ${styles[`section_${n.data?.status}`]}`}>
                  <div className={styles.sectionLeft}>
                    <div className={`${styles.statusDot} ${styles[`dot_${n.data?.status}`]}`} />
                    <div className={styles.sectionInfo}>
                      <div className={styles.sectionName}>{n.data?.label as string}</div>
                      {desc && <div className={styles.sectionDesc}>{desc}</div>}
                      {(n.data?.blockedReason as any)?.reason && (
                        <div className={styles.blockedNote}>
                          Blocked: {(n.data.blockedReason as any).reason}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={styles.sectionRight}>
                    {msgCount > 0 && <span className={styles.chip}>{msgCount} msgs</span>}
                    {hasHandoff && <span className={`${styles.chip} ${styles.chipHandoff}`}>handoff</span>}
                    <span className={`${styles.statusBadge} ${styles[`badge_${n.data?.status}`]}`}>
                      {n.data?.status as string}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Bugs ── */}
        {tab === 'bugs' && (
          <div className={styles.listPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelMeta}>
                {openBugs.length} open · {fixedBugs.length} fixed
              </div>
              <button className={styles.addBtn} onClick={() => setShowBugForm(v => !v)}>
                {showBugForm ? 'Cancel' : '+ Log bug'}
              </button>
            </div>

            {showBugForm && (
              <div className={styles.form}>
                <input
                  className={styles.formInput}
                  placeholder="Bug description..."
                  value={bugDesc}
                  onChange={e => setBugDesc(e.target.value)}
                  autoFocus
                />
                <select
                  className={styles.formInput}
                  value={bugSection}
                  onChange={e => setBugSection(e.target.value)}
                >
                  <option value="">Affected section...</option>
                  {sections.map(n => (
                    <option key={n.id} value={n.data?.label as string}>{n.data?.label as string}</option>
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
              <div className={styles.empty}>No bugs logged.</div>
            )}

            {openBugs.length > 0 && (
              <div className={styles.bugGroup}>
                <div className={styles.bugGroupLabel}>Open</div>
                {openBugs.map(b => (
                  <div key={b.id} className={styles.bugRow}>
                    <div className={styles.bugDot} />
                    <div className={styles.bugInfo}>
                      <div className={styles.bugDesc}>{b.description}</div>
                      <div className={styles.bugMeta}>{b.affectedSection}</div>
                    </div>
                    <div className={styles.bugActions}>
                      <button className={styles.fixBtn} onClick={() => fixBug(b.id)}>Fix</button>
                      <button className={styles.deleteBtn} onClick={() => deleteBug(b.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {fixedBugs.length > 0 && (
              <div className={styles.bugGroup}>
                <div className={styles.bugGroupLabel}>Fixed</div>
                {fixedBugs.map(b => (
                  <div key={b.id} className={`${styles.bugRow} ${styles.bugRowFixed}`}>
                    <div className={`${styles.bugDot} ${styles.bugDotFixed}`} />
                    <div className={styles.bugInfo}>
                      <div className={styles.bugDesc}>{b.description}</div>
                      <div className={styles.bugMeta}>{b.affectedSection}</div>
                    </div>
                    <button className={styles.deleteBtn} onClick={() => deleteBug(b.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ADRs ── */}
        {tab === 'adrs' && (
          <div className={styles.listPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.panelMeta}>
                Architecture decisions are injected into every Claude session context.
              </div>
              <button className={styles.addBtn} onClick={() => setShowAdrForm(v => !v)}>
                {showAdrForm ? 'Cancel' : '+ Add decision'}
              </button>
            </div>

            {showAdrForm && (
              <div className={styles.form}>
                <input
                  className={styles.formInput}
                  placeholder="Decision title (e.g. Use Supabase for auth)"
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
                    Save decision
                  </button>
                </div>
              </div>
            )}

            {adrs.length === 0 && !showAdrForm && (
              <div className={styles.empty}>No architecture decisions recorded.</div>
            )}

            {adrs.map(adr => (
              <div key={adr.id} className={styles.adrRow}>
                <div className={styles.adrDot} />
                <div className={styles.adrInfo}>
                  <div className={styles.adrTitle}>{adr.title}</div>
                  <div className={styles.adrDecision}>{adr.decision}</div>
                  <div className={styles.adrReason}>{adr.reason}</div>
                </div>
                <button className={styles.deleteBtn} onClick={() => deleteAdr(adr.id)}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* ── Export ── */}
        {tab === 'export' && (
          <div className={styles.exportPanel}>
            <div className={styles.exportDesc}>
              Generates a complete project handoff document — all sections, decisions, open bugs, and session summaries.
              Copy to clipboard and share.
            </div>
            <button className={styles.exportBtn} onClick={handleExport}>
              {copied ? 'Copied to clipboard' : 'Export handoff doc'}
            </button>
            <div className={styles.exportNote}>
              Handoff docs are auto-generated at the end of each session. Sections without a session have no summary.
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
