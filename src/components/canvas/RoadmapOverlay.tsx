import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './RoadmapOverlay.module.css'

const STATUS_LABEL: Record<string, string> = {
  idle:      'Not started',
  active:    'In progress',
  done:      'Done',
  blocked:   'Blocked',
  minimized: 'Minimized',
}

export default function RoadmapOverlay() {
  const { nodes, toggleRoadmap, updateNodeStatus } = useWorkstationStore()
  const mainFlow = nodes.filter(n => n.data.kind === 'section' || n.data.kind === 'overview')
  const tangents = nodes.filter(n => n.data.kind === 'tangent')

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className={styles.title}>⊞ Roadmap</span>
          <button className={styles.close} onClick={toggleRoadmap}>✕</button>
        </div>

        <div className={styles.section}>
          <span className={styles.sectionLabel}>Main Flow</span>
          <ol className={styles.list}>
            {mainFlow.map((node, i) => (
              <li key={node.id} className={styles.item}>
                <span className={styles.step}>{i + 1}</span>
                <span className={styles.nodeName}>{node.data.label}</span>
                <select
                  className={`${styles.statusBadge} ${styles[node.data.status]}`}
                  value={node.data.status}
                  onChange={e => updateNodeStatus(node.id, e.target.value as any)}
                >
                  {['idle', 'active', 'done', 'blocked'].map(s => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </li>
            ))}
          </ol>
        </div>

        {tangents.length > 0 && (
          <div className={styles.section}>
            <span className={styles.sectionLabel}>Tangents</span>
            <ol className={styles.list}>
              {tangents.map(node => (
                <li key={node.id} className={styles.item}>
                  <span className={styles.tangentIcon}>↓</span>
                  <span className={styles.nodeName}>{node.data.label}</span>
                  <select
                    className={`${styles.statusBadge} ${styles[node.data.status]}`}
                    value={node.data.status}
                    onChange={e => updateNodeStatus(node.id, e.target.value as any)}
                  >
                    {['idle', 'active', 'done', 'blocked'].map(s => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
