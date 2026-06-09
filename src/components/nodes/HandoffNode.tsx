import { memo, useState } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { WorkstationNodeData } from '@/types'
import styles from './HandoffNode.module.css'

function HandoffNode({ data }: NodeProps<WorkstationNodeData>) {
  const [expanded, setExpanded] = useState(false)
  const doc = data.handoffDoc

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
          <Field label="What was built" value={doc.whatWasBuilt} />
          <Field label="Decisions made"  value={doc.decisionsMAde} />
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
          {doc.tangentsSummary && (
            <Field label="Tangents" value={doc.tangentsSummary} />
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
