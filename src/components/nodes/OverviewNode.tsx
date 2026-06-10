import { memo } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { WorkstationNodeData } from '@/types'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './OverviewNode.module.css'

function OverviewNode({ selected }: NodeProps<WorkstationNodeData>) {
  const project = useWorkstationStore(s => s.project)
  const nodes = useWorkstationStore(s => s.nodes)

  const sections = nodes.filter(n => n.data.kind === 'section')
  const done = sections.filter(n => n.data.status === 'done').length
  const total = sections.length
  const openBugs = (project?.bugs ?? []).filter(b => b.status === 'open').length

  return (
    <div className={`${styles.node} ${selected ? styles.selected : ''}`}>
      <Handle type="source" position={Position.Right} className={styles.handle} />

      <div className={styles.accent} />

      <div className={styles.body}>
        <div className={styles.name}>{project?.name ?? 'Project'}</div>
        <div className={styles.stack}>{project?.stack ?? 'No stack set'}</div>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statVal}>{total > 0 ? `${done}/${total}` : '—'}</span>
            <span className={styles.statLabel}>sections</span>
          </div>
          {openBugs > 0 && (
            <div className={styles.stat}>
              <span className={styles.statVal} style={{ color: 'rgba(248,113,113,0.8)' }}>{openBugs}</span>
              <span className={styles.statLabel}>open bugs</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(OverviewNode)
