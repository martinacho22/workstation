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
import SectionNode        from '@/components/nodes/SectionNode'
import OverviewNode       from '@/components/nodes/OverviewNode'
import HandoffNode        from '@/components/nodes/HandoffNode'
import DeployNode         from '@/components/nodes/DeployNode'
import BugNode            from '@/components/nodes/BugNode'
import MinimizedPills     from '@/components/canvas/MinimizedPills'
import Toolbar            from '@/components/canvas/Toolbar'
import RoadmapOverlay     from '@/components/canvas/RoadmapOverlay'
import ProjectSetup       from '@/components/canvas/ProjectSetup'
import ProgressBackground from '@/components/canvas/ProgressBackground'
import { FlowEdge, TangentEdge, TiebackEdge } from '@/components/edges'

import Sidebar    from '@/components/layout/Sidebar'
import Dashboard  from '@/screens/Dashboard'
import WarRoom    from '@/screens/WarRoom'
import Projects   from '@/screens/Projects'
import Settings   from '@/screens/Settings'
import Setup      from '@/screens/Setup'
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

const SETUP_DONE_KEY = 'workstation_setup_complete'

export default function App() {
  const {
    nodes, edges,
    onNodesChange, onEdgesChange,
    project, roadmapVisible,
    setActiveNode,
  } = useWorkstationStore()

  const [screen, setScreen]             = useState<Screen>('dashboard')
  const [showSetup, setShowSetup]       = useState(false)
  const [showCLISetup, setShowCLISetup] = useState(false)

  const sidebarCollapsed = screen === 'canvas'

  useEffect(() => {
    const done = localStorage.getItem(SETUP_DONE_KEY)
    if (!done) setShowCLISetup(true)
  }, [])

  const onConnect = useCallback(() => {}, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setActiveNode(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setActiveNode])

  function handleSetupComplete() {
    localStorage.setItem(SETUP_DONE_KEY, 'true')
    setShowCLISetup(false)
  }

  function handleOpenCanvas(_projectId: string) {
    setShowSetup(false)
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

  function handleWarRoom() {
    setScreen('warroom')
  }

  if (showCLISetup) {
    return <Setup onComplete={handleSetupComplete} />
  }

  return (
    <div style={{
      display: 'flex',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg)',
    }}>
      <Sidebar
        current={screen}
        onChange={setScreen}
        collapsed={sidebarCollapsed}
      />

      {screen === 'dashboard' && (
        <Dashboard
          onOpenCanvas={handleOpenCanvas}
          onNewProject={handleNewProject}
          onWarRoom={handleWarRoom}
        />
      )}

      {screen === 'canvas' && (
        <div style={{ flex: 1, height: '100vh', position: 'relative' }}>
          {showSetup && !project ? (
            <ProjectSetup onDone={() => setShowSetup(false)} />
          ) : (
            <>
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
                minZoom={0.15}
                maxZoom={2}
                proOptions={{ hideAttribution: true }}
                style={{ background: 'transparent' }}
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
                    if (n.data?.kind === 'deploy')    return 'rgba(0,200,255,0.6)'
                    if (n.data?.kind === 'bug')       return 'rgba(255,96,96,0.6)'
                    if (n.data?.status === 'done')    return 'var(--done)'
                    if (n.data?.status === 'blocked') return 'rgba(255,200,60,0.6)'
                    if (n.data?.kind === 'overview')  return 'var(--accent)'
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
            </>
          )}
        </div>
      )}

      {screen === 'warroom' && <WarRoom />}

      {screen === 'projects' && (
        <Projects onLoadTemplate={handleLoadTemplate} onImport={handleImport} />
      )}

      {screen === 'settings' && <Settings />}
    </div>
  )
}
