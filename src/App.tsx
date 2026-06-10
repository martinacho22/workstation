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
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useWorkstationStore } from '@/store/useWorkstationStore'
import SectionNode       from '@/components/nodes/SectionNode'
import OverviewNode      from '@/components/nodes/OverviewNode'
import NodeWorkspace     from '@/components/nodes/NodeWorkspace'
import { FlowEdge }      from '@/components/edges'
import Toolbar           from '@/components/canvas/Toolbar'
import ProjectSetup      from '@/components/canvas/ProjectSetup'
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

// When workspace is open, canvas takes this % of the canvas column height
// Workspace gets the rest.
const CANVAS_SPLIT_PCT  = 42   // canvas: 42%
const WORKSPACE_MIN_PX  = 320  // never shorter than this

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

  const workspaceOpen = !!activeNodeId && screen === 'canvas'

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
        <div style={{ flex: 1, height: '100%', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

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
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                  {/* Toolbar — fixed above canvas, not inside ReactFlow */}
                  <div style={{
                    flexShrink:     0,
                    borderBottom:   '1px solid rgba(255,255,255,0.06)',
                    background:     'rgba(10,10,18,0.95)',
                    backdropFilter: 'blur(8px)',
                  }}>
                    <Toolbar onNewProject={() => setShowSetup(true)} />
                  </div>

                  {/* Canvas + workspace split */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

                    {/* Canvas — shrinks when workspace is open */}
                    <div style={{
                      flex:       workspaceOpen ? `0 0 ${CANVAS_SPLIT_PCT}%` : '1',
                      minHeight:  workspaceOpen ? 120 : undefined,
                      position:   'relative',
                      transition: 'flex 0.2s ease',
                      overflow:   'hidden',
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
                        fitViewOptions={{ padding: 0.35 }}
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
                        <Controls style={{
                          background:   'var(--surface, rgba(255,255,255,0.05))',
                          border:       '1px solid var(--border, rgba(255,255,255,0.08))',
                          borderRadius: 8,
                        }} />
                        {!workspaceOpen && (
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
                        )}

                        {/* Empty canvas prompt */}
                        {!project && (
                          <div style={{
                            position:   'absolute',
                            top:        '50%',
                            left:       '50%',
                            transform:  'translate(-50%,-50%)',
                            textAlign:  'center',
                            color:      'rgba(255,255,255,0.18)',
                            fontSize:   13,
                            lineHeight: 1.6,
                            pointerEvents: 'none',
                          }}>
                            <div style={{ fontSize: 26, marginBottom: 8, opacity: 0.2 }}>⬡</div>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>No project open</div>
                            <div style={{ fontSize: 12, opacity: 0.7 }}>
                              Describe your idea in the Orchestrator panel →
                            </div>
                          </div>
                        )}
                      </ReactFlow>
                    </div>

                    {/* NodeWorkspace — inline panel below canvas */}
                    {workspaceOpen && (
                      <div style={{
                        flex:       `1 1 ${100 - CANVAS_SPLIT_PCT}%`,
                        minHeight:  WORKSPACE_MIN_PX,
                        overflow:   'hidden',
                        display:    'flex',
                        flexDirection: 'column',
                      }}>
                        <NodeWorkspace />
                      </div>
                    )}

                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── RIGHT: orchestrator panel — always visible ── */}
        <OrchestratorPanel showChat={screen === 'canvas'} />

      </div>
    </>
  )
}
