import { memo, useState } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { WorkstationNodeData } from '@/types'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import TerminalPane from '@/components/panes/TerminalPane'
import ChatPane from '@/components/panes/ChatPane'
import NodeHeader from '@/components/nodes/NodeHeader'
import styles from './SectionNode.module.css'

function SectionNode({ id, data, selected }: NodeProps<WorkstationNodeData>) {
  const { activeNodeId, setActiveNode, updateNodeStatus, addBugNode } = useWorkstationStore()
  const isActive = activeNodeId === id
  const [expanded, setExpanded] = useState(false)
  const [showBlockedModal, setShowBlockedModal] = useState(false)
  const [blockedReason, setBlockedReason] = useState('')
  const [blockedBy, setBlockedBy] = useState('')
  const [showContextFile, setShowContextFile] = useState(false)
  const [showBugModal, setShowBugModal] = useState(false)
  const [bugDesc, setBugDesc] = useState('')

  const nodes = useWorkstationStore(s => s.nodes)
  const sectionNodes = nodes.filter(n => n.id !== id && (n.data.kind === 'section' || n.data.kind === 'overview'))

  if (data.status === 'minimized') return null

  function handleMarkBlocked() {
    if (!blockedReason.trim()) return
    updateNodeStatus(id, 'blocked', {
      reason: blockedReason.trim(),
      blockedBy: blockedBy || undefined,
      since: Date.now(),
    })
    setShowBlockedModal(false)
    setBlockedReason('')
    setBlockedBy('')
  }

  function handleAddBug() {
    if (!bugDesc.trim()) return
    addBugNode(id, bugDesc.trim())
    setShowBugModal(false)
    setBugDesc('')
  }

  return (
    <div
      className={`
        ${styles.node}
        ${isActive ? styles.active : ''}
        ${data.status === 'done' ? styles.done : ''}
        ${data.status === 'blocked' ? styles.blocked : ''}
        ${selected ? styles.selected : ''}
      `}
      onClick={() => setActiveNode(id)}
      style={{ width: expanded ? 900 : 480 }}
    >
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <Handle type="source" position={Position.Right} className={styles.handle} />
      <Handle type="source" position={Position.Bottom} id="tangent" className={styles.handleBottom} />

      <NodeHeader
        id={id}
        data={data}
        expanded={expanded}
        onToggleExpand={() => setExpanded(e => !e)}
      />

      {/* Blocked banner */}
      {data.status === 'blocked' && data.blockedReason && (
        <div className={styles.blockedBanner}>
          <span className={styles.blockedIcon}>⚠</span>
          <span className={styles.blockedText}>
            <strong>Blocked:</strong> {data.blockedReason.reason}
            {data.blockedReason.blockedBy && (
              <span className={styles.blockedBy}> — waiting on {
                nodes.find(n => n.id === data.blockedReason?.blockedBy)?.data.label || 'unknown'
              }</span>
            )}
          </span>
          <button
            className={styles.unblockBtn}
            onClick={(e) => { e.stopPropagation(); updateNodeStatus(id, 'idle') }}
          >
            Unblock
          </button>
        </div>
      )}

      {/* Quick action bar */}
      <div className={styles.quickActions} onClick={e => e.stopPropagation()}>
        <button
          className={styles.qaBtn}
          title="Mark as blocked"
          onClick={() => setShowBlockedModal(true)}
          disabled={data.status === 'blocked' || data.status === 'done'}
        >
          ⚠ Block
        </button>
        <button
          className={styles.qaBtn}
          title="Add bug from this section"
          onClick={() => setShowBugModal(true)}
        >
          🐛 Bug
        </button>
        {data.contextFile && (
          <button
            className={styles.qaBtn}
            title="View context file"
            onClick={() => setShowContextFile(v => !v)}
          >
            📋 Context
          </button>
        )}
      </div>

      {/* Context file preview */}
      {showContextFile && data.contextFile && (
        <div className={styles.contextPreview} onClick={e => e.stopPropagation()}>
          <div className={styles.contextHeader}>
            <span>Context File (auto-injected)</span>
            <button className={styles.contextCopy} onClick={() => navigator.clipboard.writeText(data.contextFile || '')}>Copy</button>
            <button className={styles.contextClose} onClick={() => setShowContextFile(false)}>✕</button>
          </div>
          <pre className={styles.contextContent}>{data.contextFile}</pre>
        </div>
      )}

      <div className={styles.body}>
        <div className={styles.terminalPane}>
          <TerminalPane nodeId={id} active={isActive} />
        </div>
        <div className={styles.divider} />
        <div className={styles.chatPane}>
          <ChatPane nodeId={id} data={data} />
        </div>
      </div>

      {/* Blocked modal */}
      {showBlockedModal && (
        <div className={styles.modal} onClick={e => e.stopPropagation()}>
          <div className={styles.modalContent}>
            <h4 className={styles.modalTitle}>⚠ Mark as Blocked</h4>
            <label className={styles.modalLabel}>Why is this blocked?</label>
            <input
              className={styles.modalInput}
              placeholder="e.g. Waiting for auth to be done first"
              value={blockedReason}
              onChange={e => setBlockedReason(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleMarkBlocked()}
            />
            <label className={styles.modalLabel}>Blocked by which section? (optional)</label>
            <select
              className={styles.modalSelect}
              value={blockedBy}
              onChange={e => setBlockedBy(e.target.value)}
            >
              <option value="">None</option>
              {sectionNodes.map(n => (
                <option key={n.id} value={n.id}>{n.data.label}</option>
              ))}
            </select>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setShowBlockedModal(false)}>Cancel</button>
              <button className={styles.modalConfirm} onClick={handleMarkBlocked} disabled={!blockedReason.trim()}>
                Mark Blocked
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bug modal */}
      {showBugModal && (
        <div className={styles.modal} onClick={e => e.stopPropagation()}>
          <div className={styles.modalContent}>
            <h4 className={styles.modalTitle}>🐛 New Bug</h4>
            <label className={styles.modalLabel}>Describe the bug</label>
            <input
              className={styles.modalInput}
              placeholder="e.g. Login button crashes on mobile Safari"
              value={bugDesc}
              onChange={e => setBugDesc(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleAddBug()}
            />
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setShowBugModal(false)}>Cancel</button>
              <button className={styles.modalConfirm} onClick={handleAddBug} disabled={!bugDesc.trim()}>
                Add Bug Node
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(SectionNode)
