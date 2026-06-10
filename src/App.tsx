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
import SectionNode       from '@/components/nodes/SectionNode'
import OverviewNode      from '@/components/nodes/OverviewNode'
import { FlowEdge }      from '@/components/edges'
import Toolbar           from '@/components/canvas/Toolbar'
import ProjectSetup      from '@/components/canvas/ProjectSetup'
import SessionView       from '@/components/session/SessionView'
import OrchestratorPanel from '@/components/orchestrator/OrchestratorPanel'
import Sidebar           from '@/components/layout/Sidebar'
import ElectronHeader    from '@/components/layout/ElectronHeader'
import Dashboard         from '@/screens/Dashboard'
import WarRoom           from '@/screens/WarRoom'
import Settings          from '@/screens/Settings'
import Setup             from '@/screens/Setup'

// ─── Constants ────────────────────────────────────────────────────────────────

const HEADER_H       = 40
const SETUP_DONE_KEY = 'workstation_setup_complete'

const nodeTypes: NodeTypes = {
  sectionNode:  SectionNode,
  overviewNode: OverviewNode,
}
const edgeTypes: EdgeTypes = {
  flowEdge: FlowEdge,
}

type Screen = 'canvas' | 'dashboard' | 'warroom' | 'settings'

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const {
    nodes, edges,
    onNodesChange, onEdgesChange,
    project, activeNodeId, setActiveNode,
  } = useWorkstationStore()

  const [screen, setScreen]             = useState<Screen>('canvas')
  const [showSetup, setShowSetup]       = useState(false)
  const [showCLISetup, setShowCLISetup] = useState(false)

  useEffect(() => {
    const done = localStorage.getItem(SETUP_DONE_KEY)
    if (!done) setShowCLISetup(true)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setActiveNode(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setActiveNode])

  const onConnect = useCallback(() => {}, [])

  const handleScreenChange = (s: Screen) => {
    if (s !== 'canvas') setActiveNode(null)
    setScreen(s)
  }

  // ── First launch wizard ───────────────────────────────────────────────────
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
      {/* ── Persistent titlebar ── */}
      <ElectronHeader />

      {/* ── Main layout: sidebar | content | orchestrator ── */}
      <div style={{
        display:    'flex',
        width:      '100vw',
        height:     `calc(100vh - ${HEADER_H}px)`,
        marginTop:  HEADER_H,
        overflow:   'hidden',
        background: 'var(--bg, #0d0d14)',
      }}>

        {/* ── LEFT: persistent sidebar nav ── */}
        <Sidebar screen={screen} onChange={handleScreenChange} />

        {/* ── CENTRE: main content area ── */}
        <div style={{ flex: 1, height: '100%', position: 'relative', overflow: 'hidden' }}>

          {/* Dashboard */}
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

          {/* War Room */}
          {screen === 'warroom' && <WarRoom />}

          {/* Settings */}
          {screen === 'settings' && <Settings />}

          {/* Canvas */}
          {screen === 'canvas' && (
            <>
              {showSetup && !project ? (
                <ProjectSetup onDone={() => setShowSetup(false)} />
              ) : (
                <>
                  {/* Canvas — fades when session is open */}
                  <div style={{
                    position:      'absolute',
                    inset:         0,
                    opacity:       sessionOpen ? 0 : 1,
                    pointerEvents: sessionOpen ? 'none' : 'auto',
                    transition:    'opacity 0.15s',
                    display:       'flex',
                    flexDirection: 'column',
                  }}>
                    {/* Toolbar fixed above canvas, not floating inside */}
                    <div style={{
                      flexShrink:     0,
                      borderBottom:   '1px solid rgba(255,255,255,0.06)',
                      background:     'rgba(10,10,18,0.95)',
                      backdropFilter: 'blur(8px)',
                    }}>
                      <Toolbar onNewProject={() => setShowSetup(true)} />
                    </div>

                    <div style={{ flex: 1, position: 'relative' }}>
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
                        <Controls style={{
                          background:   'var(--surface, rgba(255,255,255,0.05))',
                          border:       '1px solid var(--border, rgba(255,255,255,0.08))',
                          borderRadius: 8,
                        }} />
                        <MiniMap
                          style={{
                            background:   'var(--surface, rgba(255,255,255,0.03))',
                            border:       '1px solid var(--border, rgba(255,255,255,0.06))',
                            borderRadius: 8,
                          }}
                          nodeColor={(n) => {
                            if (n.data?.status === 'done')     return 'rgba(74,222,128,0.6)'
                            if (n.data?.status === 'blocked')  return 'rgba(240,192,64,0.6)'
                            if (n.data?.status === 'active')   return 'rgba(0,255,136,0.6)'
                            if (n.data?.kind   === 'overview') return 'var(--accent, #00ff88)'
                            return 'rgba(255,255,255,0.08)'
                          }}
                          maskColor="rgba(10,10,15,0.7)"
                        />

                        {/* Empty canvas prompt */}
                        {!project && (
                          <Panel position="top-center" style={{ marginTop: 60 }}>
                            <div style={{
                              textAlign:  'center',
                              color:      'rgba(255,255,255,0.18)',
                              fontSize:   13,
                              lineHeight: 1.6,
                            }}>
                              <div style={{ fontSize: 26, marginBottom: 8, opacity: 0.25 }}>⬡</div>
                              <div style={{ fontWeight: 600, marginBottom: 4 }}>No project open</div>
                              <div style={{ fontSize: 12, opacity: 0.7 }}>
                                Describe your idea in the Orchestrator panel →
                              </div>
                            </div>
                          </Panel>
                        )}
                      </ReactFlow>
                    </div>
                  </div>

                  {/* Session view overlay */}
                  {sessionOpen && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
                      <SessionView />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* ── RIGHT: orchestrator panel — always visible ──────────────────── */}
        {/* showChat=true on canvas, false on other screens (roadmap+tasks only) */}
        <OrchestratorPanel showChat={screen === 'canvas'} />

      </div>
    </>
  )
}
