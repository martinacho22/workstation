import { WorkstationNodeData } from '@/types'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './NodeHeader.module.css'

const STATUS_LABELS: Record<WorkstationNodeData['status'], string> = {
  idle: 'Idle',
  active: 'Active',
  done: 'Done',
  blocked: 'Blocked',
  minimized: 'Minimized',
}

interface Props {
  id: string
  data: WorkstationNodeData
  expanded: boolean
  onToggleExpand: () => void
}

export default function NodeHeader({ id, data, expanded, onToggleExpand }: Props) {
  const { minimizeNode, addTangentNode, updateNodeStatus } = useWorkstationStore()

  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <span className={`${styles.dot} ${styles[data.status]}`} />
        <span className={styles.label}>{data.label}</span>
        <span className={styles.kind}>{data.kind}</span>
      </div>

      <div className={styles.right}>
        <span className={styles.status}>{STATUS_LABELS[data.status]}</span>

        {data.kind !== 'overview' && (
          <button
            className={styles.btn}
            title="New tangent"
            onClick={(e) => {
              e.stopPropagation()
              addTangentNode(id, 'Tangent')
            }}
          >
            ⤵
          </button>
        )}

        <button
          className={styles.btn}
          title={expanded ? 'Collapse' : 'Expand'}
          onClick={(e) => { e.stopPropagation(); onToggleExpand() }}
        >
          {expanded ? '⊙' : '⊕'}
        </button>

        <button
          className={styles.btn}
          title="Minimize"
          onClick={(e) => { e.stopPropagation(); minimizeNode(id) }}
        >
          −
        </button>

        {data.status !== 'done' && (
          <button
            className={`${styles.btn} ${styles.doneBtn}`}
            title="Mark done"
            onClick={(e) => { e.stopPropagation(); updateNodeStatus(id, 'done') }}
          >
            ✓
          </button>
        )}
      </div>
    </div>
  )
}
