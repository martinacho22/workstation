import { useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './WarRoom.module.css'

type Tab = 'overview' | 'sections' | 'bugs' | 'tangents' | 'handoffs' | 'deploy' | 'adrs' | 'checklist'

export default function WarRoom() {
  const {
    project, nodes,
    addAdr, deleteAdr,
    generateChecklist, toggleChecklistItem, checklistLoading,
    exportFinalHandoff,
  } = useWorkstationStore()

  const [tab, setTab] = useState<Tab>('overview')
  const [adrTitle, setAdrTitle]       = useState('')
  const [adrDecision, setAdrDecision] = useState('')
  const [adrReason, setAdrReason]     = useState('')
  const [showAdrForm, setShowAdrForm] = useState(false)
  const [exportCopied, setExportCopied] = useState(false)

  const sectionNodes  = nodes.filter(n => n.data?.kind === 'section')
  const bugNodes      = nodes.filter(n => n.data?.kind === 'bug')
  const tangentNodes  = nodes.filter(n => n.data?.kind === 'tangent')
  const handoffNodes  = nodes.filter(n => n.data?.kind === 'handoff')
  const deployNodes   = nodes.filter(n => n.data?.kind === 'deploy')

  const done          = sectionNodes.filter(n => n.data?.status === 'done').length
  const blocked       = sectionNodes.filter(n => n.data?.status === 'blocked').length
  const total         = sectionNodes.length
  const progress      = total > 0 ? Math.round((done / total) * 100) : 0
  const openTangents  = tangentNodes.filter(n => !n.data?.resolvedTo).length
  const adrs          = project?.adrs ?? []
  const checklist     = project?.completionChecklist ?? []
  const checklistDone = checklist.filter(i => i.done).length

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'sections',  label: 'Sections',  count: total },
    { id: 'bugs',      label: 'Bugs',      count: bugNodes.length },
    { id: 'tangents',  label: 'Tangents',  count: tangentNodes.length },
    { id: 'handoffs',  label: 'Handoffs',  count: handoffNodes.length },
    { id: 'deploy',    label: 'Deploy',    count: deployNodes.length },
    { id: 'adrs',      label: 'Decisions', count: adrs.length },
    { id: 'checklist', label: 'Checklist', count: checklist.length > 0 ? checklist.length : undefined },
  ]

  function handleAddAdr() {
    if (!adrTitle.trim() || !adrDecision.trim() || !adrReason.trim()) return
    addAdr(adrTitle.trim(), adrDecision.trim(), adrReason.trim())
    setAdrTitle('')
    setAdrDecision('')
    setAdrReason('')
    setShowAdrForm(false)
  }

  function handleExport() {
    const md = exportFinalHandoff()
    navigator.clipboard.writeText(md).then(() => {
      setExportCopied(true)
      setTimeout(() => setExportCopied(false), 2000)
    })
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>War Room</h1>
          <p className={styles.subtitle}>{project?.name ?? 'No project loaded'}</p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.progressPill}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress}%` }} />
            </div>
            <span className={styles.progressLabel}>{progress}% complete</span>
          </div>
          <button className={styles.exportBtn} onClick={handleExport}>
            {exportCopied ? 'Copied to clipboard' : 'Export Final Handoff'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.activeTab : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={styles.tabCount}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={styles.content}>

        {/* Overview */}
        {tab === 'overview' && (
          <div className={styles.overviewGrid}>
            <StatCard label="Total Sections" value={total} />
            <StatCard label="Done"           value={done}              accent="#4ade80" />
            <StatCard label="Blocked"        value={blocked}           accent="#f0c040" />
            <StatCard label="Open Bugs"      value={bugNodes.length}   accent="#f87171" />
            <StatCard label="Open Tangents"  value={openTangents}      accent="#f0c040" />
            <StatCard label="Handoff Docs"   value={handoffNodes.length} accent="var(--accent)" />

            {blocked > 0 && (
              <div className={styles.alertCard}>
                <div className={styles.alertIndicator} style={{ background: '#f0c040' }} />
                <div>
                  <div className={styles.alertTitle}>{blocked} section{blocked > 1 ? 's' : ''} blocked</div>
                  <div className={styles.alertDesc}>Review blocked sections and unblock them to continue.</div>
                </div>
              </div>
            )}

            {openTangents > 0 && (
              <div className={styles.alertCard} style={{ borderColor: 'rgba(240,192,64,0.2)' }}>
                <div className={styles.alertIndicator} style={{ background: '#f0c040' }} />
                <div>
                  <div className={styles.alertTitle}>{openTangents} unresolved tangent{openTangents > 1 ? 's' : ''}</div>
                  <div className={styles.alertDesc}>Resolve tangents before marking the project complete.</div>
                </div>
              </div>
            )}

            {checklist.length > 0 && (
              <div className={styles.alertCard} style={{ borderColor: 'rgba(0,255,136,0.15)' }}>
                <div className={styles.alertIndicator} style={{ background: 'var(--accent)' }} />
                <div>
                  <div className={styles.alertTitle}>Completion checklist: {checklistDone}/{checklist.length}</div>
                  <div className={styles.alertDesc}>
                    {checklistDone === checklist.length
                      ? 'All items complete — ready to ship.'
                      : `${checklist.length - checklistDone} items remaining before the project is done.`}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sections */}
        {tab === 'sections' && (
          <div className={styles.list}>
            {sectionNodes.length === 0 && <EmptyState label="No sections yet — start in the canvas" />}
            {sectionNodes.map(n => (
              <div key={n.id} className={styles.listItem}>
                <div className={styles.listItemLeft}>
                  <StatusDot status={n.data?.status as string} />
                  <div>
                    <div className={styles.listItemName}>{n.data?.label as string ?? 'Untitled'}</div>
                    {n.data?.blockedReason && (
                      <div className={styles.blockedReason}>
                        Blocked: {(n.data.blockedReason as { reason: string }).reason}
                      </div>
                    )}
                    {n.data?.definitionOfDone && (
                      <div className={styles.listItemSub}>Done when: {n.data.definitionOfDone as string}</div>
                    )}
                  </div>
                </div>
                <span className={styles.statusBadge} data-status={n.data?.status}>
                  {(n.data?.status as string ?? 'idle')}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Bugs */}
        {tab === 'bugs' && (
          <div className={styles.list}>
            {bugNodes.length === 0 && <EmptyState label="No bugs filed" />}
            {bugNodes.map(n => (
              <div key={n.id} className={styles.listItem}>
                <div className={styles.listItemLeft}>
                  <div className={styles.bugDot} />
                  <div>
                    <div className={styles.listItemName}>{n.data?.label as string ?? 'Untitled bug'}</div>
                    <div className={styles.listItemSub}>{n.data?.bugDescription as string ?? ''}</div>
                  </div>
                </div>
                <span className={styles.statusBadge} data-status={n.data?.status === 'done' ? 'done' : 'active'}>
                  {n.data?.status === 'done' ? 'Fixed' : 'Open'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Tangents */}
        {tab === 'tangents' && (
          <div className={styles.list}>
            {tangentNodes.length === 0 && <EmptyState label="No tangents — clean workflow" />}
            {tangentNodes.map(n => (
              <div key={n.id} className={styles.listItem}>
                <div className={styles.listItemLeft}>
                  <div className={styles.tangentDot} style={{ background: n.data?.resolvedTo ? '#4ade80' : '#f0c040' }} />
                  <div>
                    <div className={styles.listItemName}>{n.data?.label as string ?? 'Tangent'}</div>
                    {n.data?.resolvedTo && (
                      <div className={styles.listItemSub}>
                        Resolved — tied back to {nodes.find(x => x.id === n.data.resolvedTo)?.data.label ?? 'unknown'}
                      </div>
                    )}
                  </div>
                </div>
                <span className={styles.statusBadge} data-status={n.data?.resolvedTo ? 'done' : 'active'}>
                  {n.data?.resolvedTo ? 'Resolved' : 'Open'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Handoffs */}
        {tab === 'handoffs' && (
          <div className={styles.list}>
            {handoffNodes.length === 0 && <EmptyState label="No handoff docs yet — generate them from section nodes" />}
            {handoffNodes.map(n => (
              <div key={n.id} className={`${styles.listItem} ${styles.handoffItem}`}>
                <div className={styles.listItemLeft}>
                  <div className={styles.handoffDot} />
                  <div>
                    <div className={styles.listItemName}>{n.data?.label as string ?? 'Handoff Doc'}</div>
                    {n.data?.handoffDoc && (
                      <div className={styles.listItemSub}>
                        {(n.data.handoffDoc as { currentStatus: string }).currentStatus}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Deploy */}
        {tab === 'deploy' && (
          <div className={styles.list}>
            {deployNodes.length === 0 && <EmptyState label="No deploy node yet — add one from the canvas toolbar" />}
            {deployNodes.map(n => (
              <div key={n.id} className={styles.listItem}>
                <div className={styles.listItemLeft}>
                  <div className={styles.deployDot} />
                  <div>
                    <div className={styles.listItemName}>{n.data?.deployTarget as string ?? 'Deploy'}</div>
                    <div className={styles.listItemSub}>{n.data?.deployStatus as string ?? 'Not deployed'}</div>
                  </div>
                </div>
                <span className={styles.statusBadge} data-status={n.data?.deployStatus === 'live' ? 'done' : 'idle'}>
                  {n.data?.deployStatus === 'live' ? 'Live' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Architecture Decisions */}
        {tab === 'adrs' && (
          <div className={styles.adrPanel}>
            <div className={styles.adrHeader}>
              <div className={styles.adrHeaderText}>
                Architecture decisions made during this project. These are injected into every Claude context file.
              </div>
              <button
                className={styles.addAdrBtn}
                onClick={() => setShowAdrForm(v => !v)}
              >
                {showAdrForm ? 'Cancel' : '+ Add Decision'}
              </button>
            </div>

            {showAdrForm && (
              <div className={styles.adrForm}>
                <input
                  className={styles.adrInput}
                  placeholder="Decision title (e.g. Use Supabase for auth)"
                  value={adrTitle}
                  onChange={e => setAdrTitle(e.target.value)}
                />
                <input
                  className={styles.adrInput}
                  placeholder="Decision (e.g. Use Supabase Auth over custom JWT)"
                  value={adrDecision}
                  onChange={e => setAdrDecision(e.target.value)}
                />
                <input
                  className={styles.adrInput}
                  placeholder="Reason (e.g. Faster to ship, handles edge cases)"
                  value={adrReason}
                  onChange={e => setAdrReason(e.target.value)}
                />
                <button className={styles.saveAdrBtn} onClick={handleAddAdr}>
                  Save Decision
                </button>
              </div>
            )}

            {adrs.length === 0 && !showAdrForm && (
              <EmptyState label="No architecture decisions recorded yet" />
            )}

            <div className={styles.list}>
              {adrs.map(adr => (
                <div key={adr.id} className={styles.adrItem}>
                  <div className={styles.adrItemLeft}>
                    <div className={styles.adrDot} />
                    <div>
                      <div className={styles.adrTitle}>{adr.title}</div>
                      <div className={styles.adrDecision}>{adr.decision}</div>
                      <div className={styles.adrReason}>{adr.reason}</div>
                    </div>
                  </div>
                  <button
                    className={styles.deleteAdrBtn}
                    onClick={() => deleteAdr(adr.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completion Checklist */}
        {tab === 'checklist' && (
          <div className={styles.checklistPanel}>
            <div className={styles.checklistHeader}>
              <div className={styles.checklistHeaderText}>
                {checklist.length > 0
                  ? `${checklistDone} of ${checklist.length} items complete`
                  : 'Generate a checklist to track what needs to be done before shipping.'}
              </div>
              <button
                className={styles.generateChecklistBtn}
                onClick={generateChecklist}
                disabled={checklistLoading}
              >
                {checklistLoading ? 'Generating...' : checklist.length > 0 ? 'Regenerate' : 'Generate Checklist'}
              </button>
            </div>

            {checklist.length === 0 && !checklistLoading && (
              <EmptyState label="No checklist yet — click Generate Checklist above" />
            )}

            <div className={styles.checklist}>
              {checklist.map(item => (
                <div
                  key={item.id}
                  className={`${styles.checklistItem} ${item.done ? styles.checklistItemDone : ''}`}
                  onClick={() => toggleChecklistItem(item.id)}
                >
                  <div className={`${styles.checkbox} ${item.done ? styles.checkboxDone : ''}`}>
                    {item.done && '✓'}
                  </div>
                  <span className={styles.checklistLabel}>{item.label}</span>
                  {item.sectionId && (
                    <span className={styles.checklistSection}>{item.sectionId}</span>
                  )}
                </div>
              ))}
            </div>

            {checklist.length > 0 && checklistDone === checklist.length && (
              <div className={styles.allDone}>
                All items complete. Export your final handoff and ship it.
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <span style={{ fontSize: 26, fontWeight: 700, color: accent ?? '#fff' }}>{value}</span>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'done'    ? '#4ade80' :
    status === 'blocked' ? '#f0c040' :
    status === 'active'  ? 'var(--accent)' :
    'rgba(255,255,255,0.2)'
  return (
    <span style={{
      width: 8, height: 8, borderRadius: '50%',
      background: color, flexShrink: 0, marginTop: 5,
      display: 'inline-block',
    }} />
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{
      padding: '40px 0', textAlign: 'center',
      color: 'rgba(255,255,255,0.2)', fontSize: 13,
    }}>
      {label}
    </div>
  )
}
