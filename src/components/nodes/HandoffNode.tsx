import { memo, useState } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { WorkstationNodeData } from '@/types'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './HandoffNode.module.css'

function HandoffNode({ id, data }: NodeProps<WorkstationNodeData>) {
  const [expanded, setExpanded] = useState(false)
  const { getDependencies, getDependants } = useWorkstationStore()
  const doc = data.handoffDoc

  const deps       = getDependencies(id)
  const dependants = getDependants(id)

  if (!doc) return null

  const ts = new Date(doc.lastUpdated).toLocaleString()

  return (
    <div className={`${styles.node} ${expanded ? styles.expanded : ''}`}>
      <Handle type="target" position={Position.Top} className={styles.handle} />

      <div className={styles.header} onClick={() => setExpanded(e => !e)}>
        <span className={styles.icon}>📄</span>
        <span className={styles.title}>Handoff — {doc.nodeLabel}</span>
        <span className={styles.timestamp}>{ts}</span>
        <span className={styles.toggle}>{expanded ? '▲' : '▼'}</span>
      </div>

      {!expanded && (
        <div className={styles.preview}>
          <span className={styles.previewText}>{doc.currentStatus || 'No status yet'}</span>
        </div>
      )}

      {expanded && (
        <div className={styles.body}>
          {/* Dependency info */}
          {deps.length > 0 && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Depends on</span>
              <p className={styles.fieldValue}>
                {deps.map(d => `${d.data.label} (${d.data.status})`).join(', ')}
              </p>
            </div>
          )}
          {dependants.length > 0 && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Blocks</span>
              <p className={styles.fieldValue}>
                {dependants.map(d => d.data.label).join(', ')}
              </p>
            </div>
          )}

          <Field label="What was built" value={doc.whatWasBuilt} />
          <Field label="Decisions made"  value={doc.decisionsMade} />
          <Field label="Current status"  value={doc.currentStatus} />
          <Field label="Next steps"      value={doc.nextSteps} />
          {doc.filesChanged?.length > 0 && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Files changed</span>
              <ul className={styles.fileList}>
                {doc.filesChanged.map((f, i) => (
                  <li key={i} className={styles.file}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <p className={styles.fieldValue}>{value}</p>
    </div>
  )
}

export default memo(HandoffNode)
