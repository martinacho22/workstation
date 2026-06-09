import { useState, useRef, useEffect } from 'react'
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
  expanded?: boolean
  onToggleExpand?: () => void
  icon?: string
  accentOverride?: string
}

export default function NodeHeader({ id, data, expanded, onToggleExpand, icon, accentOverride }: Props) {
  const {
    minimizeNode, addTangentNode, updateNodeStatus, deleteNode,
    renameNode, resolveTangent, nodes, generateHandoffDoc,
  } = useWorkstationStore()

  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState(data.label)
  const [showResolve, setShowResolve] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const renameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) renameRef.current?.focus()
  }, [renaming])

  function commitRename() {
    renameNode(id, renameVal)
    setRenaming(false)
  }

  const resolveTargets = nodes.filter(
    n => n.id !== id && (n.data.kind === 'section' || n.data.kind === 'overview')
  )

  const dotStyle = accentOverride
    ? { background: accentOverride }
    : undefined

  return (
    <div className={styles.header}>
      <div className={styles.left}>
        {icon && <span className={styles.nodeIcon}>{icon}</span>}
        <span
          className={`${styles.dot} ${styles[data.status]}`}
          style={dotStyle}
        />

        {renaming ? (
          <input
            ref={renameRef}
            className={styles.renameInput}
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setRenameVal(data.label); setRenaming(false) }
            }}
          />
        ) : (
          <span
            className={styles.label}
            title="Double-click to rename"
            onDoubleClick={() => { setRenameVal(data.label); setRenaming(true) }}
          >
            {data.label}
          </span>
        )}

        <span className={styles.kind}>{data.kind}</span>
      </div>

      <div className={styles.right}>
        <span className={styles.status}>{STATUS_LABELS[data.status]}</span>

        {/* Resolve tangent — only on tangent/bug nodes that aren't done */}
        {(data.kind === 'tangent' || data.kind === 'bug') && data.status !== 'done' && (
          <div className={styles.resolveWrapper}>
            <button
              className={`${styles.btn} ${styles.resolveBtn}`}
              title="Resolve — tie it back"
              onClick={(e) => { e.stopPropagation(); setShowResolve(v => !v) }}
            >
              ↩ Resolve
            </button>
            {showResolve && (
              <div className={styles.resolveDropdown}>
                <div className={styles.resolveTitle}>Tie back to:</div>
                {resolveTargets.map(n => (
                  <button
                    key={n.id}
                    className={styles.resolveOption}
                    onClick={(e) => {
                      e.stopPropagation()
                      resolveTangent(id, n.id)
                      setShowResolve(false)
                    }}
                  >
                    {n.data.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add tangent — not on overview, handoff, deploy, bug */}
        {data.kind !== 'overview' && data.kind !== 'handoff' && data.kind !== 'deploy' && data.kind !== 'bug' && (
          <button
            className={styles.btn}
            title="New tangent from this node"
            onClick={(e) => {
              e.stopPropagation()
              const label = window.prompt('Name this tangent:')
              if (label?.trim()) addTangentNode(id, label.trim())
            }}
          >
            ⤵
          </button>
        )}

        {/* Generate handoff doc */}
        {(data.kind === 'section' || data.kind === 'tangent') && (
          <button
            className={`${styles.btn} ${styles.handoffBtn}`}
            title="Generate handoff doc"
            onClick={(e) => { e.stopPropagation(); generateHandoffDoc(id) }}
          >
            📄
          </button>
        )}

        {onToggleExpand && (
          <button
            className={styles.btn}
            title={expanded ? 'Collapse' : 'Expand'}
            onClick={(e) => { e.stopPropagation(); onToggleExpand() }}
          >
            {expanded ? '⊙' : '⊕'}
          </button>
        )}

        <button
          className={styles.btn}
          title="Minimize"
          onClick={(e) => { e.stopPropagation(); minimizeNode(id) }}
        >
          −
        </button>

        {/* Done / Un-done toggle */}
        <button
          className={`${styles.btn} ${data.status === 'done' ? styles.undoneBtn : styles.doneBtn}`}
          title={data.status === 'done' ? 'Mark as in progress' : 'Mark done'}
          onClick={(e) => {
            e.stopPropagation()
            updateNodeStatus(id, data.status === 'done' ? 'idle' : 'done')
          }}
        >
          {data.status === 'done' ? '↺' : '✓'}
        </button>

        {/* Delete — with confirm */}
        {data.kind !== 'overview' && (
          <div className={styles.deleteWrapper}>
            {showDeleteConfirm ? (
              <>
                <button
                  className={`${styles.btn} ${styles.deleteConfirmBtn}`}
                  title="Confirm delete"
                  onClick={(e) => { e.stopPropagation(); deleteNode(id) }}
                >
                  ✕ Delete
                </button>
                <button
                  className={styles.btn}
                  onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false) }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                className={`${styles.btn} ${styles.deleteBtn}`}
                title="Delete node"
                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true) }}
              >
                🗑
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
