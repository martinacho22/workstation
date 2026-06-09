import { useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './WarRoom.module.css'

type Tab = 'overview' | 'sections' | 'bugs' | 'tangents' | 'handoffs' | 'deploy'

export default function WarRoom() {
  const { project, nodes } = useWorkstationStore()
  const [tab, setTab] = useState<Tab>('overview')

  const sectionNodes  = nodes.filter(n => n.data?.kind === 'section')
  const bugNodes      = nodes.filter(n => n.data?.kind === 'bug')
  const tangentNodes  = nodes.filter(n => n.data?.kind === 'tangent')
  const handoffNodes  = nodes.filter(n => n.data?.kind === 'handoff')
  const deployNodes   = nodes.filter(n => n.data?.kind === 'deploy')

  const done    = sectionNodes.filter(n => n.data?.status === 'done').length
  const blocked = sectionNodes.filter(n => n.data?.status === 'blocked').length
  const total   = sectionNodes.length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview',  label: 'Overview' },
    { id: 'sections',  label: 'Sections',  count: total },
    { id: 'bugs',      label: 'Bugs',       count: bugNodes.length },
    { id: 'tangents',  label: 'Tangents',   count: tangentNodes.length },
    { id: 'handoffs',  label: 'Handoffs',   count: handoffNodes.length },
    { id: 'deploy',    label: 'Deploy',     count: deployNodes.length },
  ]

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>War Room</h1>
          <p className={styles.subtitle}>{project?.name ?? 'No project loaded'}</p>
        </div>
        <div className={styles.progressPill}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <span className={styles.progressLabel}>{progress}% complete</span>
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

        {tab === 'overview' && (
          <div className={styles.overviewGrid}>
            <StatCard label="Total Sections"  value={total}                  />
            <StatCard label="Done"            value={done}    accent="#4ade80" />
            <StatCard label="Blocked"         value={blocked} accent="#f0c040" />
            <StatCard label="Open Bugs"       value={bugNodes.length}     accent="#f87171" />
            <StatCard label="Open Tangents"   value={tangentNodes.filter(n => !n.data?.resolved).length} accent="#f0c040" />
            <StatCard label="Handoff Docs"    value={handoffNodes.length} accent="var(--accent)" />

            {blocked > 0 && (
              <div className={styles.alertCard}>
                <span className={styles.alertIcon}>⚠️</span>
                <div>
                  <div className={styles.alertTitle}>{blocked} section{blocked > 1 ? 's' : ''} blocked</div>
                  <div className={styles.alertDesc}>Review blocked sections and unblock them to continue progress.</div>
                </div>
              </div>
            )}

            {tangentNodes.filter(n => !n.data?.resolved).length > 0 && (
              <div className={styles.alertCard} style={{ borderColor: 'rgba(240,192,64,0.2)' }}>
                <span className={styles.alertIcon}>↘</span>
                <div>
                  <div className={styles.alertTitle}>{tangentNodes.filter(n => !n.data?.resolved).length} unresolved tangent{tangentNodes.filter(n => !n.data?.resolved).length > 1 ? 's' : ''}</div>
                  <div className={styles.alertDesc}>Resolve tangents before marking the project complete.</div>
                </div>
              </div>
            )}
          </div>
        )}

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
                      <div className={styles.blockedReason}>⚠ {n.data.blockedReason as string}</div>
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

        {tab === 'bugs' && (
          <div className={styles.list}>
            {bugNodes.length === 0 && <EmptyState label="No bugs filed — great sign 🎉" />}
            {bugNodes.map(n => (
              <div key={n.id} className={styles.listItem}>
                <div className={styles.listItemLeft}>
                  <span style={{ color: '#f87171', fontSize: 16 }}>🐛</span>
                  <div>
                    <div className={styles.listItemName}>{n.data?.label as string ?? 'Untitled bug'}</div>
                    <div className={styles.listItemSub}>{n.data?.description as string ?? ''}</div>
                  </div>
                </div>
                <span className={styles.statusBadge} data-status={n.data?.fixed ? 'done' : 'active'}>
                  {n.data?.fixed ? 'Fixed' : 'Open'}
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === 'tangents' && (
          <div className={styles.list}>
            {tangentNodes.length === 0 && <EmptyState label="No tangents — clean workflow 👌" />}
            {tangentNodes.map(n => (
              <div key={n.id} className={styles.listItem}>
                <div className={styles.listItemLeft}>
                  <span style={{ color: n.data?.resolved ? '#4ade80' : '#f0c040', fontSize: 16 }}>↘</span>
                  <div>
                    <div className={styles.listItemName}>{n.data?.label as string ?? 'Tangent'}</div>
                    {n.data?.tiebackTarget && (
                      <div className={styles.listItemSub}>Ties back to: {n.data.tiebackTarget as string}</div>
                    )}
                  </div>
                </div>
                <span className={styles.statusBadge} data-status={n.data?.resolved ? 'done' : 'active'}>
                  {n.data?.resolved ? 'Resolved' : 'Open'}
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === 'handoffs' && (
          <div className={styles.list}>
            {handoffNodes.length === 0 && <EmptyState label="No handoff docs yet — generate them from section nodes" />}
            {handoffNodes.map(n => (
              <div key={n.id} className={`${styles.listItem} ${styles.handoffItem}`}>
                <div className={styles.listItemLeft}>
                  <span style={{ color: 'var(--accent)', fontSize: 16 }}>📄</span>
                  <div>
                    <div className={styles.listItemName}>{n.data?.label as string ?? 'Handoff Doc'}</div>
                    <div className={styles.listItemSub}>{n.data?.updatedAt as string ?? ''}</div>
                  </div>
                </div>
                <button className={styles.viewBtn}>View →</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'deploy' && (
          <div className={styles.list}>
            {deployNodes.length === 0 && <EmptyState label="No deploy node yet — add one from the canvas toolbar" />}
            {deployNodes.map(n => (
              <div key={n.id} className={styles.listItem}>
                <div className={styles.listItemLeft}>
                  <span style={{ color: '#00c8ff', fontSize: 16 }}>🚀</span>
                  <div>
                    <div className={styles.listItemName}>{n.data?.platform as string ?? 'Deploy'}</div>
                    <div className={styles.listItemSub}>{n.data?.status as string ?? 'Not deployed'}</div>
                  </div>
                </div>
                <span className={styles.statusBadge} data-status={n.data?.deployed ? 'done' : 'idle'}>
                  {n.data?.deployed ? '✓ Live' : 'Pending'}
                </span>
              </div>
            ))}
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
  const color = status === 'done' ? '#4ade80' : status === 'blocked' ? '#f0c040' : status === 'active' ? 'var(--accent)' : 'rgba(255,255,255,0.2)'
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 5 }} />
}

function EmptyState({ label }: { label: string }) {
  return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
      {label}
    </div>
  )
}
