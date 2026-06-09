import { memo } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { WorkstationNodeData } from '@/types'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import ChatPane from '@/components/panes/ChatPane'
import styles from './OverviewNode.module.css'

function OverviewNode({ id, data }: NodeProps<WorkstationNodeData>) {
  const { activeNodeId, setActiveNode, project } = useWorkstationStore()
  const isActive = activeNodeId === id

  return (
    <div
      className={`${styles.node} ${isActive ? styles.active : ''}`}
      onClick={() => setActiveNode(id)}
    >
      <Handle type="source" position={Position.Right} className={styles.handle} />

      <div className={styles.header}>
        <div className={styles.icon}>◈</div>
        <div className={styles.meta}>
          <span className={styles.title}>{project?.name || 'Overview'}</span>
          <span className={styles.subtitle}>project brain</span>
        </div>
        <div className={styles.dot} />
      </div>

      <div className={styles.body}>
        <ChatPane nodeId={id} data={data} isOverview />
      </div>
    </div>
  )
}

export default memo(OverviewNode)
