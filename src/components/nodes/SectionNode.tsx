import { memo, useState } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { WorkstationNodeData }         from '@/types'
import { useWorkstationStore }         from '@/store/useWorkstationStore'
import { useChatSessionsStore }        from '@/store/chatSessionsStore'
import InlineTerminal                  from './InlineTerminal'
import styles from './SectionNode.module.css'

function SectionNode({ id, data, selected }: NodeProps<WorkstationNodeData>) {
  const { updateNodeStatus, deleteNode, renameNode, nodes } = useWorkstationStore()
  const { sessions, openChat, closeChat, toggleMinimise }   = useChatSessionsStore()

  const [renaming, setRenaming]             = useState(false)
  const [renameVal, setRenameVal]           = useState(data.label)
  const [showMenu, setShowMenu]             = useState(false)
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [blockReason, setBlockReason]       = useState('')
  const [blockBy, setBlockBy]               = useState('')
  const [terminalOpen, setTerminalOpen]     = useState(false)
  const [hintSeen, setHintSeen]             = useState(false)

  const session    = sessions[id]
  const chatOpen   = !!session && !session.minimised
  const chatExists = !!session

  const lastMsg = session?.messages?.length
    ? session.messages[session.messages.length - 1]
    : null
  const lastMsgPreview = lastMsg
    ? (lastMsg.content.length > 72
        ? lastMsg.content.slice(0, 72) + '…'
        : lastMsg.content)
    : null

  const blueprint   = useWorkstationStore(s => s.project?.blueprint)
  const bpIdx       = blueprint?.findIndex(b => b.label === data.label) ?? 0
  const sectionDesc = blueprint?.find(b => b.label === data.label)?.description

  const sectionNodes = nodes.filter(n => n.id !== id && (n.data.kind === 'section' || n.data.kind === 'overview'))
  const messageCount = session?.messages?.length ?? data.chatHistory?.length ?? 0
  const hasHandoff   = !!data.handoffDoc

  const expanded = chatOpen || terminalOpen

  function commitRename() {
    renameNode(id, renameVal)
    setRenaming(false)
  }

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (showMenu) { setShowMenu(false); return }
    setHintSeen(true)

    if (!chatExists) {
      openChat(id, bpIdx)
    } else if (chatOpen) {
      toggleMinimise(id)
    } else {
      toggleMinimise(id)
    }
  }

  function handleDoubleClick(e: React.MouseEvent) {
    e.stopPropagation()
    setTerminalOpen(v => !v)
    setHintSeen(true)
    if (!chatExists) openChat(id, bpIdx)
  }

  const statusColor =
    data.status === 'done'    ? '#4ade80' :
    data.status === 'blocked' ? '#f0c040' :
    data.status === 'active'  ? 'var(--accent)' :
    'rgba(255,255,255,0.12)'

  function handleMarkBlocked() {
    if (!blockReason.trim()) return
    updateNodeStatus(id, 'blocked', {
      reason:    blockReason.trim(),
      // Store the human-readable label instead of the opaque nanoid
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
          chatOpen  ? styles.active    : '',
          expanded  ? styles.expanded  : '',
          data.status === 'done'    ? styles.done    : '',
          data.status === 'blocked' ? styles.blocked : '',
        ].join(' ')}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setShowMenu(v => !v) }}
      >
        <Handle type="target" position={Position.Left}  className={styles.handle} />
        <Handle type="source" position={Position.Right} className={styles.handle} />

        <div className={styles.statusBar} style={{ background: statusColor }} />

        {terminalOpen && (
          <div className={styles.sessionDot} title="Claude Code session open" />
        )}

        {chatOpen && <div className={styles.chatRing} />}

        <div className={styles.body}>
          {renaming ? (
            <input
              className={styles.renameInput}
              value={renameVal}
              autoFocus
              onChange={e => setRenameVal(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter')  commitRename()
                if (e.key === 'Escape') { setRenameVal(data.label); setRenaming(false) }
              }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <div className={styles.label}>{data.label}</div>
          )}

          {sectionDesc && (
            <div className={styles.desc}>{sectionDesc}</div>
          )}

          {data.status === 'blocked' && data.blockedReason && (
            <div className={styles.blockedBadge}>
              ⚠ {data.blockedReason.reason}
              {data.blockedReason.blockedBy && (
                <span style={{ opacity: 0.6, marginLeft: 4 }}>
                  (by: {data.blockedReason.blockedBy})
                </span>
              )}
            </div>
          )}

          {expanded && (
            <div className={styles.expandedSection}>
              {lastMsgPreview && (
                <div className={styles.lastMsgPreview}>
                  <span className={styles.lastMsgRole}>
                    {lastMsg?.role === 'user' ? 'you' : '◈'}
                  </span>
                  <span className={styles.lastMsgText}>{lastMsgPreview}</span>
                </div>
              )}

              <button
                className={styles.launchTerminalBtn}
                onClick={e => { e.stopPropagation(); setTerminalOpen(v => !v) }}
              >
                {terminalOpen ? '⌘ Close terminal' : '⌘ Launch Claude Code'}
              </button>

              {terminalOpen && (
                <div className={styles.terminalActiveBadge}>
                  <span className={styles.terminalDot} />
                  Session active
                </div>
              )}
            </div>
          )}

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
            </div>
          </div>
        </div>

        {!hintSeen && (
          <div className={styles.hintBar}>
            <span>click → chat</span>
            <span>dbl-click → terminal</span>
          </div>
        )}

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
            {chatExists && (
              <button className={styles.menuItem} onClick={() => { closeChat(id); setShowMenu(false) }}>
                Close chat
              </button>
            )}
            <div className={styles.menuDivider} />
            <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={() => { deleteNode(id); closeChat(id); setShowMenu(false) }}>
              Delete
            </button>
          </div>
        )}

        {terminalOpen && (
          <InlineTerminal
            nodeId={id}
            onClose={() => setTerminalOpen(false)}
          />
        )}
      </div>

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
                <option key={n.id} value={n.data.label as string}>{n.data.label}</option>
              ))}
            </select>
            <div className={styles.modalActions}>
              <button className={styles.modalCancel}  onClick={() => setShowBlockModal(false)}>Cancel</button>
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
