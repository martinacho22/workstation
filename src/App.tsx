import { useCallback, useEffect, useState } from 'react'
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
import SectionNode  from '@/components/nodes/SectionNode'
import OverviewNode from '@/components/nodes/OverviewNode'
import HandoffNode  from '@/components/nodes/HandoffNode'
import DeployNode   from '@/components/nodes/DeployNode'
import BugNode      from '@/components/nodes/BugNode'
import MinimizedPills    from '@/components/canvas/MinimizedPills'
import Toolbar           from '@/components/canvas/Toolbar'
import RoadmapOverlay    from '@/components/canvas/RoadmapOverlay'
import ProjectSetup      from '@/components/canvas/ProjectSetup'
import ProgressBackground from '@/components/canvas/ProgressBackground'
import ApiKeyModal       from '@/components/canvas/ApiKeyModal'
import { FlowEdge, TangentEdge, TiebackEdge } from '@/components/edges'

import Sidebar    from '@/components/layout/Sidebar'
import Dashboard  from '@/screens/Dashboard'
import WarRoom    from '@/screens/WarRoom'
import Projects   from '@/screens/Projects'
import Settings   from '@/screens/Settings'
import { Screen } from '@/types/screens'

const nodeTypes: NodeTypes = {
  sectionNode:  SectionNode,
  overviewNode: OverviewNode,
  handoffNode:  HandoffNode,
  deployNode:   DeployNode,
  bugNode:      BugNode,
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
    apiKey, showApiKeyModal,
    setActiveNode,
  } = useWorkstationStore()

  const [screen, setScreen]       = useState<Screen>('dashboard')
  const [showSetup, setShowSetup] = useState(false)

  // Collapse sidebar when on canvas
  const sidebarCollapsed = screen === 'canvas'

  const onConnect = useCallback(() => {}, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setActiveNode(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setActiveNode])

  function handleOpenCanvas(_projectId: string) {
    setScreen('canvas')
  }

  function handleNewProject() {
    setShowSetup(true)
    setScreen('canvas')
  }

  function handleLoadTemplate(_templateId: string) {
    setShowSetup(true)
    setScreen('canvas')
  }

  function handleImport(_path: string) {
    setScreen('canvas')
  }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar
        current={screen}
        onChange={setScreen}
        collapsed={sidebarCollapsed}
      />

      {/* Dashboard */}
      {screen === 'dashboard' && (
        <Dashboard onOpenCanvas={handleOpenCanvas} onNewProject={handleNewProject} />
      )}

      {/* Canvas */}
      {screen === 'canvas' && (
        <div style={{ flex: 1, height: '100vh', position: 'relative' }}>
          {showSetup && !project ? (
            <ProjectSetup onDone={() => setShowSetup(false)} />
          ) : (
            <>
              <ProgressBackground />

              {!apiKey && (
                <div
                  onClick={showApiKeyModal}
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 56,
                    right: 0,
                    zIndex: 50,
                    background: 'rgba(240,165,0,0.12)',
                    borderBottom: '1px solid rgba(240,165,0,0.3)',
                    color: '#f0c040',
                    fontSize: '12px',
                    textAlign: 'center',
                    padding: '6px',
                    cursor: 'pointer',
                    letterSpacing: '0.03em',
                  }}
                >
                  ⚠️ No API key set — reasoning chat and handoff docs won't work.{' '}
                  <span style={{ textDecoration: 'underline' }}>Click to add your key →</span>
                </div>
              )}

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
                minZoom={0.15}
                maxZoom={2}
                proOptions={{ hideAttribution: true }}
                style={{ background: 'transparent', marginTop: apiKey ? 0 : 32 }}
                onPaneClick={() => setActiveNode(null)}
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
                    if (n.data?.kind === 'deploy')   return 'rgba(0,200,255,0.6)'
                    if (n.data?.kind === 'bug')      return 'rgba(255,96,96,0.6)'
                    if (n.data?.status === 'done')   return 'var(--done)'
                    if (n.data?.status === 'blocked') return 'rgba(255,200,60,0.6)'
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
              <ApiKeyModal />
            </>
          )}
        </div>
      )}

      {/* War Room */}
      {screen === 'warroom' && <WarRoom />}

      {/* Projects */}
      {screen === 'projects' && (
        <Projects onLoadTemplate={handleLoadTemplate} onImport={handleImport} />
      )}

      {/* Settings */}
      {screen === 'settings' && <Settings />}
    </div>
  )
}
