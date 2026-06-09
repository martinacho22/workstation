import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import { WorkstationNodeData } from '@/types'
import NodeHeader from './NodeHeader'
import ChatPane from '../panes/ChatPane'
import styles from './BugNode.module.css'

interface Props {
  data: WorkstationNodeData
  id: string
}

export default function BugNode({ data, id }: Props) {
  const { nodes, resolveTangent, updateNodeStatus } = useWorkstationStore()
  const project = useWorkstationStore(s => s.project)
  const [tab, setTab] = useState<'details' | 'chat'>('details')
  const [resolveTarget, setResolveTarget] = useState('')
  const [showResolve, setShowResolve] = useState(false)
  const [steps, setSteps] = useState(data.bugStepsToReproduce || '')

  const sectionNodes = nodes.filter(n => n.data.kind === 'section' || n.data.kind === 'overview')
  const isFixed = data.status === 'done'

  function handleResolve() {
    if (!resolveTarget) return
    resolveTangent(id, resolveTarget)
    setShowResolve(false)
  }

  const systemContext = [
    `You are a debugging expert. Help fix this bug.`,
    `Bug: ${data.bugDescription || data.label}`,
    `Affected section: ${data.bugAffectedSection || 'unknown'}`,
    steps ? `Steps to reproduce: ${steps}` : '',
    project?.stack ? `Project stack: ${project.stack}` : '',
    `Be direct. Identify root cause first, then provide the fix.`,
  ].filter(Boolean).join('\n')

  return (
    <div className={`${styles.node} ${isFixed ? styles.fixed : ''}`}>
      <Handle type="target" position={Position.Top} className={styles.handle} />

      <NodeHeader id={id} data={data} accentOverride="#ff6060" />

      <div className={styles.affectedTag}>
        Affects: <span>{data.bugAffectedSection || 'unknown section'}</span>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'details' ? styles.tabActive : ''}`}
          onClick={() => setTab('details')}
        >
          Details
        </button>
        <button
          className={`${styles.tab} ${tab === 'chat' ? styles.tabActive : ''}`}
          onClick={() => setTab('chat')}
        >
          Debug Chat
        </button>
      </div>

      <div className={styles.tabContent}>
        {tab === 'details' && (
          <div className={styles.details}>
            <div className={styles.field}>
              <label className={styles.label}>Bug Description</label>
              <p className={styles.description}>{data.bugDescription || data.label}</p>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Steps to Reproduce</label>
              <textarea
                className={styles.stepsInput}
                placeholder="1. Go to...&#10;2. Click...&#10;3. See error"
                value={steps}
                onChange={e => setSteps(e.target.value)}
                rows={3}
              />
            </div>

            <div className={styles.actions}>
              {!isFixed ? (
                <button
                  className={styles.markFixed}
                  onClick={() => {
                    updateNodeStatus(id, 'done')
                    setShowResolve(true)
                  }}
                >
                  Mark Fixed
                </button>
              ) : (
                <span className={styles.fixedBadge}>Fixed</span>
              )}
            </div>

            {showResolve && (
              <div className={styles.resolvePanel}>
                <label className={styles.label}>Tie back to which section?</label>
                <select
                  className={styles.resolveSelect}
                  value={resolveTarget}
                  onChange={e => setResolveTarget(e.target.value)}
                >
                  <option value="">Select section...</option>
                  {sectionNodes.map(n => (
                    <option key={n.id} value={n.id}>{n.data.label}</option>
                  ))}
                </select>
                <button
                  className={styles.resolveBtn}
                  onClick={handleResolve}
                  disabled={!resolveTarget}
                >
                  Tie Back
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'chat' && (
          <ChatPane nodeId={id} data={data} systemContext={systemContext} />
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className={styles.handle} />
    </div>
  )
}
