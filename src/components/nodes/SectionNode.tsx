import { memo, useState } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { WorkstationNodeData } from '@/types'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import InlineTerminal from './InlineTerminal'
import styles from './SectionNode.module.css'

function SectionNode({ id, data, selected }: NodeProps<WorkstationNodeData>) {
  const { updateNodeStatus, deleteNode, renameNode, nodes, activeNodeId, setActiveNode } =
    useWorkstationStore()

  const [renaming, setRenaming]             = useState(false)
  const [renameVal, setRenameVal]           = useState(data.label)
  const [showMenu, setShowMenu]             = useState(false)
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [blockReason, setBlockReason]       = useState('')
  const [blockBy, setBlockBy]               = useState('')

  // Terminal state — per node, lives on the canvas
  const [terminalOpen, setTerminalOpen]     = useState(false)

  // isActive = this node is the active chat node (FloatingChatCard is open for it)
  const isActive      = activeNodeId === id
  // hasSession = this node has an open terminal (accent dot shown)
  const hasSession    = terminalOpen

  const sectionNodes  = nodes.filter(n => n.id !== id && (n.data.kind === 'section' || n.data.kind === 'overview'))
  const messageCount  = data.chatHistory?.length ?? 0
  const hasHandoff    = !!data.handoffDoc
  const blueprint     = useWorkstationStore(s => s.project?.blueprint)
  const sectionDesc   = blueprint?.find(b => b.label === data.label)?.description

  function commitRename() {
    renameNode(id, renameVal)
    setRenaming(false)
  }

  // Single click → open FloatingChatCard for this node
  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (showMenu) { setShowMenu(false); return }
    // Toggle active chat node
    setActiveNode(isActive ? null : id)
  }

  // Double click → open inline terminal
  function handleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation()
    setTerminalOpen(v => !v)
    // Also mark as active so chat opens too
    if (!isActive) setActiveNode(id)
  }

  const statusColor =
    data.status === 'done'    ? 'var(--done, #4ade80)' :
    data.status === 'blocked' ? '#f0c040' :
    data.status === 'active'  ? 'var(--accent)' :
    'rgba(255,255,255,0.12)'

  function handleMarkBlocked() {
    if (!blockReason.trim()) return
    updateNodeStatus(id, 'blocked', {
      reason:    blockReason.trim(),
      blockedBy: blockBy || undefined,
      since:     Date.now(),
    })
    setShowBlockModal(false)
    setBlockReason('')
    setBlockBy('')
  }

  return (
    <>
      <div
        className={[
          styles.node,
          selected  ? styles.selected  : '',
          isActive  ? styles.active    : '',
          data.status === 'done'    ? styles.done    : '',
          data.status === 'blocked' ? styles.blocked : '',
        ].join(' ')}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setShowMenu(v => !v) }}
      >
        <Handle type="target" position={Position.Left}  className={styles.handle} />
        <Handle type="source" position={Position.Right} className={styles.handle} />

        {/* Left status bar */}
        <div className={styles.statusBar} style={{ background: statusColor }} />

        {/* Session dot — shown above node when terminal is open */}
        {hasSession && (
          <div
            className={styles.sessionDot}
            title="Claude Code session open — double-click to toggle"
          />
        )}

        <div className={styles.body}>
          {/* Label */}
          {renaming ? (
            <input
              className={styles.renameInput}
              value={renameVal}
              autoFocus
              onChange={e => setRenameVal(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') { setRenameVal(data.label); setRenaming(false) }
              }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <div
              className={styles.label}
              onDoubleClick={e => {
                // Handled by node's onDoubleClick — don't rename on body dbl-click
                e.stopPropagation()
              }}
            >
              {data.label}
            </div>
          )}

          {/* Description from blueprint */}
          {sectionDesc && (
            <div className={styles.desc}>{sectionDesc}</div>
          )}

          {/* Blocked reason */}
          {data.status === 'blocked' && data.blockedReason && (
            <div className={styles.blockedBadge}>
              Blocked: {data.blockedReason.reason}
            </div>
          )}

          {/* Footer meta */}
          <div className={styles.footer}>
            <span className={`${styles.statusLabel} ${styles[`status_${data.status}`]}`}>
              {data.status}
            </span>
            <div className={styles.footerRight}>
              {messageCount > 0 && (
                <span className={styles.metaChip}>{messageCount} msgs</span>
              )}
              {hasHandoff && (
                <span className={styles.metaChip} style={{ color: 'var(--accent)', borderColor: 'rgba(0,255,136,0.2)' }}>
                  handoff
                </span>
              )}
              {terminalOpen && (
                <span className={styles.metaChip} style={{ color: 'var(--accent)', borderColor: 'rgba(0,255,136,0.35)', background: 'rgba(0,255,136,0.06)' }}>
                  ⌘ live
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Hint bar at bottom — shows on hover */}
        <div className={styles.hintBar}>
          <span>click → chat</span>
          <span>dbl-click → terminal</span>
        </div>

        {/* Active indicator strip */}
        {isActive && <div className={styles.activeBar} />}

        {/* Context menu */}
        {showMenu && (
          <div className={styles.menu} onClick={e => e.stopPropagation()}>
            <button className={styles.menuItem} onClick={() => { setRenameVal(data.label); setRenaming(true); setShowMenu(false) }}>
              Rename
            </button>
            <button className={styles.menuItem} onClick={() => {
              updateNodeStatus(id, data.status === 'done' ? 'idle' : 'done')
              setShowMenu(false)
            }}>
              {data.status === 'done' ? 'Reopen' : 'Mark done'}
            </button>
            {data.status !== 'blocked' && (
              <button className={styles.menuItem} onClick={() => { setShowBlockModal(true); setShowMenu(false) }}>
                Mark blocked
              </button>
            )}
            {data.status === 'blocked' && (
              <button className={styles.menuItem} onClick={() => { updateNodeStatus(id, 'idle'); setShowMenu(false) }}>
                Unblock
              </button>
            )}
            <button className={styles.menuItem} onClick={() => { setTerminalOpen(v => !v); setShowMenu(false) }}>
              {terminalOpen ? 'Close terminal' : 'Open terminal'}
            </button>
            <div className={styles.menuDivider} />
            <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={() => { deleteNode(id); setShowMenu(false) }}>
              Delete
            </button>
          </div>
        )}

        {/* Inline terminal — spawns below node, stays on canvas */}
        {terminalOpen && (
          <InlineTerminal
            nodeId={id}
            onClose={() => setTerminalOpen(false)}
          />
        )}
      </div>

      {/* Block modal — outside node div so it covers full screen */}
      {showBlockModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowBlockModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h4 className={styles.modalTitle}>Mark as blocked</h4>
            <input
              className={styles.modalInput}
              placeholder="Why is this blocked?"
              value={blockReason}
              onChange={e => setBlockReason(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleMarkBlocked()}
            />
            <select
              className={styles.modalSelect}
              value={blockBy}
              onChange={e => setBlockBy(e.target.value)}
            >
              <option value="">Blocked by… (optional)</option>
              {sectionNodes.map(n => (
                <option key={n.id} value={n.id}>{n.data.label}</option>
              ))}
            </select>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel} onClick={() => setShowBlockModal(false)}>Cancel</button>
              <button className={styles.modalConfirm} onClick={handleMarkBlocked} disabled={!blockReason.trim()}>
                Mark blocked
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default memo(SectionNode)
