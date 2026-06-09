import { useCallback, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  NodeTypes,
  EdgeTypes,
  ConnectionMode,
  Panel,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useWorkstationStore } from '@/store/useWorkstationStore'
import SectionNode from '@/components/nodes/SectionNode'
import OverviewNode from '@/components/nodes/OverviewNode'
import HandoffNode from '@/components/nodes/HandoffNode'
import MinimizedPills from '@/components/canvas/MinimizedPills'
import Toolbar from '@/components/canvas/Toolbar'
import RoadmapOverlay from '@/components/canvas/RoadmapOverlay'
import ProjectSetup from '@/components/canvas/ProjectSetup'
import ProgressBackground from '@/components/canvas/ProgressBackground'
import { FlowEdge, TangentEdge, TiebackEdge } from '@/components/edges'

const nodeTypes: NodeTypes = {
  sectionNode:  SectionNode,
  overviewNode: OverviewNode,
  handoffNode:  HandoffNode,
}

const edgeTypes: EdgeTypes = {
  flowEdge:    FlowEdge,
  tangentEdge: TangentEdge,
  tiebackEdge: TiebackEdge,
}

export default function App() {
  const {
    nodes, edges,
    onNodesChange, onEdgesChange,
    project, roadmapVisible,
    addSectionNode, addTangentNode,
  } = useWorkstationStore()

  const [showSetup, setShowSetup] = useState(!project)

  const onConnect = useCallback(() => {}, [])

  if (showSetup) {
    return <ProjectSetup onDone={() => setShowSetup(false)} />
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'var(--bg)', position: 'relative' }}>
      <ProgressBackground />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1}
          color="rgba(255,255,255,0.04)"
        />

        <Controls
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
        />

        <MiniMap
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          }}
          nodeColor={(n) => {
            if (n.data?.status === 'done') return 'var(--done)'
            if (n.data?.kind === 'overview') return 'var(--accent)'
            return 'var(--surface2)'
          }}
          maskColor="rgba(10,10,15,0.7)"
        />

        <Panel position="top-center">
          <Toolbar />
        </Panel>
      </ReactFlow>

      <MinimizedPills />
      {roadmapVisible && <RoadmapOverlay />}
    </div>
  )
}
