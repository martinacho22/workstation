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
import { FlowEdge }  from '@/components/edges'
import Toolbar       from '@/components/canvas/Toolbar'
import ProjectSetup  from '@/components/canvas/ProjectSetup'
import SessionView   from '@/components/session/SessionView'

import ElectronHeader from '@/components/layout/ElectronHeader'
import Sidebar        from '@/components/layout/Sidebar'
import Dashboard      from '@/screens/Dashboard'
import WarRoom        from '@/screens/WarRoom'
import Settings       from '@/screens/Settings'
import Setup          from '@/screens/Setup'
import { Screen }     from '@/types/screens'

const nodeTypes: NodeTypes = {
  sectionNode:  SectionNode,
  overviewNode: OverviewNode,
}

const edgeTypes: EdgeTypes = {
  flowEdge: FlowEdge,
}

const SETUP_DONE_KEY = 'workstation_setup_complete'

// Height of the ElectronHeader — everything shifts down by this
const HEADER_H = 40

export default function App() {
  const {
    nodes, edges,
    onNodesChange, onEdgesChange,
    project, activeNodeId, setActiveNode,
  } = useWorkstationStore()

  const [screen, setScreen]             = useState<Screen>('dashboard')
  const [showSetup, setShowSetup]       = useState(false)
  const [showCLISetup, setShowCLISetup] = useState(false)

  useEffect(() => {
    const done = localStorage.getItem(SETUP_DONE_KEY)
    if (!done) setShowCLISetup(true)
  }, [])

  // Esc closes session view
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setActiveNode(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setActiveNode])

  const onConnect = useCallback(() => {}, [])

  if (showCLISetup) {
    return (
      <>
        <ElectronHeader />
        <div style={{ paddingTop: HEADER_H, height: '100vh', boxSizing: 'border-box' }}>
          <Setup onComplete={() => {
            localStorage.setItem(SETUP_DONE_KEY, 'true')
            setShowCLISetup(false)
          }} />
        </div>
      </>
    )
  }

  const sessionOpen = !!activeNodeId && screen === 'canvas'

  return (
    <>
      {/* ── Persistent titlebar / status header ── */}
      <ElectronHeader />

      {/* ── Everything below the header ── */}
      <div style={{
        display: 'flex',
        width: '100vw',
        height: `calc(100vh - ${HEADER_H}px)`,
        marginTop: HEADER_H,
        overflow: 'hidden',
        background: 'var(--bg)',
      }}>
        <Sidebar
          current={screen}
          onChange={(s) => {
            if (s !== 'canvas') setActiveNode(null)
            setScreen(s)
          }}
          collapsed={screen === 'canvas'}
        />

        {/* ── Dashboard ── */}
        {screen === 'dashboard' && (
          <Dashboard
            onOpenCanvas={(id) => {
              useWorkstationStore.getState().switchProject(id)
              setShowSetup(false)
              setScreen('canvas')
            }}
            onNewProject={() => {
              setShowSetup(true)
              setScreen('canvas')
            }}
            onWarRoom={() => setScreen('warroom')}
          />
        )}

        {/* ── Canvas + Session ── */}
        {screen === 'canvas' && (
          <div style={{ flex: 1, height: '100%', position: 'relative', overflow: 'hidden' }}>

            {/* Project setup wizard */}
            {showSetup && !project ? (
              <ProjectSetup onDone={() => setShowSetup(false)} />
            ) : (
              <>
                {/* Canvas — hidden behind session when session is open */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: sessionOpen ? 0 : 1,
                  pointerEvents: sessionOpen ? 'none' : 'auto',
                  transition: 'opacity 0.15s',
                }}>
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
                    fitViewOptions={{ padding: 0.4 }}
                    minZoom={0.2}
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
                        if (n.data?.status === 'done')    return 'rgba(74,222,128,0.6)'
                        if (n.data?.status === 'blocked') return 'rgba(240,192,64,0.6)'
                        if (n.data?.kind === 'overview')  return 'var(--accent)'
                        return 'var(--surface2, rgba(255,255,255,0.08))'
                      }}
                      maskColor="rgba(10,10,15,0.7)"
                    />
                    {/* Toolbar offset below header — no top overlap */}
                    <Panel position="top-center" style={{ marginTop: 8 }}>
                      <Toolbar />
                    </Panel>
                  </ReactFlow>
                </div>

                {/* Session view — full screen overlay within content area */}
                {sessionOpen && (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
                    <SessionView />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── War Room ── */}
        {screen === 'warroom' && <WarRoom />}

        {/* ── Settings ── */}
        {screen === 'settings' && <Settings />}
      </div>
    </>
  )
}
