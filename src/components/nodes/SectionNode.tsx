import { memo, useState } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { WorkstationNodeData } from '@/types'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import TerminalPane from '@/components/panes/TerminalPane'
import ChatPane from '@/components/panes/ChatPane'
import NodeHeader from '@/components/nodes/NodeHeader'
import styles from './SectionNode.module.css'

function SectionNode({ id, data, selected }: NodeProps<WorkstationNodeData>) {
  const { activeNodeId, setActiveNode } = useWorkstationStore()
  const isActive = activeNodeId === id
  const [expanded, setExpanded] = useState(false)

  if (data.status === 'minimized') return null

  return (
    <div
      className={`${styles.node} ${isActive ? styles.active : ''} ${data.status === 'done' ? styles.done : ''} ${selected ? styles.selected : ''}`}
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

      <div className={styles.body}>
        <div className={styles.terminalPane}>
          <TerminalPane nodeId={id} active={isActive} />
        </div>
        <div className={styles.divider} />
        <div className={styles.chatPane}>
          <ChatPane nodeId={id} data={data} />
        </div>
      </div>
    </div>
  )
}

export default memo(SectionNode)
