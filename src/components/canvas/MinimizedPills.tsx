import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './MinimizedPills.module.css'

export default function MinimizedPills() {
  const { nodes, restoreNode } = useWorkstationStore()
  const minimized = nodes.filter(n => n.data.status === 'minimized')

  if (minimized.length === 0) return null

  return (
    <div className={styles.tray}>
      {minimized.map(node => (
        <button
          key={node.id}
          className={styles.pill}
          onClick={() => restoreNode(node.id)}
          title={`Restore "${node.data.label}"`}
        >
          <span className={styles.kindIcon}>
            {node.data.kind === 'overview' ? '◈' : node.data.kind === 'tangent' ? '↓' : '▣'}
          </span>
          <span className={styles.label}>{node.data.label}</span>
          <span className={styles.restore}>↑</span>
        </button>
      ))}
    </div>
  )
}
