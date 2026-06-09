import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './ProgressBackground.module.css'

export default function ProgressBackground() {
  const nodes = useWorkstationStore(s => s.nodes)

  const total    = nodes.filter(n => n.data.kind !== 'handoff').length
  const done     = nodes.filter(n => n.data.status === 'done').length
  const progress = total > 0 ? done / total : 0
  const pct      = Math.round(progress * 100)

  return (
    <div className={styles.bg} aria-hidden>
      <div
        className={`${styles.fill} ${pct === 100 ? styles.complete : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
