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
  Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useWorkstationStore }    from '@/store/useWorkstationStore'
import { useChatSessionsStore }   from '@/store/chatSessionsStore'
import SectionNode                from '@/components/nodes/SectionNode'
import OverviewNode               from '@/components/nodes/OverviewNode'
import { DependencyEdge, FlowEdge } from '@/components/edges'
import FloatingChatCard           from '@/components/canvas/FloatingChatCard'
import SessionTray                from '@/components/canvas/SessionTray'
import ColumnLabels               from '@/components/canvas/ColumnLabels'
import Toolbar                    from '@/components/canvas/Toolbar'
import ProjectSetup               from '@/components/canvas/ProjectSetup'
import OrchestratorPanel          from '@/components/orchestrator/OrchestratorPanel'
import Sidebar                    from '@/components/layout/Sidebar'
import ElectronHeader             from '@/components/layout/ElectronHeader'
import Dashboard                  from '@/screens/Dashboard'
import WarRoom                    from '@/screens/WarRoom'
import Settings                   from '@/screens/Settings'
import Setup                      from '@/screens/Setup'
import DevServerPanel             from '@/components/panes/DevServerPanel'
import ReliabilityBar             from '@/components/panes/ReliabilityBar'
import { nanoid }                 from 'nanoid'

const HEADER_H       = 40
const SETUP_DONE_KEY = 'workstation_setup_complete'

const nodeTypes: NodeTypes = {
  sectionNode:  SectionNode,
  overviewNode: OverviewNode,
}

const edgeTypes: EdgeTypes = {
  dependencyEdge: DependencyEdge,
  flowEdge:       FlowEdge,
  default:        DependencyEdge,
}

type Screen = 'canvas' | 'dashboard' | 'warroom' | 'settings'

export default function App() {
  const { nodes, edges, onNodesChange, onEdgesChange, project } = useWorkstationStore()
  const { sessions }  = useChatSessionsStore()

  const [screen, setScreen]             = useState<Screen>('canvas')
  const [showSetup, setShowSetup]       = useState(false)
  const [showCLISetup, setShowCLISetup] = useState(false)

  useEffect(() => {
    const done = localStorage.getItem(SETUP_DONE_KEY)
    if (!done) setShowCLISetup(true)
  }, [])

  // Wired onConnect — dragging between handles creates a FlowEdge (dashed blue)
  const onConnect = useCallback((connection: Connection) => {
    const store = useWorkstationStore.getState()
    const newEdge = {
      id:     `flow-${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source!,
      target: connection.target!,
      sourceHandle: connection.sourceHandle ?? undefined,
      targetHandle: connection.targetHandle ?? undefined,
      type:   'flowEdge',
      data:   { kind: 'flow', reason: 'Data flow' },
    }
    store.onEdgesChange([{ type: 'add', item: newEdge } as any])
  }, [])

  // ── First launch ──────────────────────────────────────────────────────────
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

  const openSessionIds = Object.keys(sessions)

  return (
    <>
      <ElectronHeader />

      <div style={{
        display:    'flex',
        width:      '100vw',
        height:     `calc(100vh - ${HEADER_H}px)`,
        marginTop:  HEADER_H,
        overflow:   'hidden',
        background: 'var(--bg, #0d0d14)',
      }}>

        {/* ── LEFT: sidebar nav ── */}
        <Sidebar screen={screen} onChange={(s) => setScreen(s as Screen)} />

        {/* ── CENTRE: main content ── */}
        <div style={{
          flex: 1, height: '100%', position: 'relative',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          {screen === 'dashboard' && (
            <Dashboard
              onOpenCanvas={(id) => {
                useWorkstationStore.getState().switchProject(id)
                setShowSetup(false)
                setScreen('canvas')
              }}
              onNewProject={() => { setShowSetup(true); setScreen('canvas') }}
              onWarRoom={() => setScreen('warroom')}
            />
          )}

          {screen === 'warroom'  && <WarRoom />}
          {screen === 'settings' && <Settings />}

          {screen === 'canvas' && (
            <>
              {showSetup && !project ? (
                <ProjectSetup onDone={() => setShowSetup(false)} />
              ) : (
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  overflow: 'hidden', height: '100%',
                }}>
                  {/* Fixed toolbar above canvas */}
                  <div style={{
                    flexShrink:     0,
                    borderBottom:   '1px solid rgba(255,255,255,0.06)',
                    background:     'rgba(10,10,18,0.95)',
                    backdropFilter: 'blur(8px)',
                  }}>
                    <Toolbar onNewProject={() => setShowSetup(true)} />
                  </div>

                  {/* Canvas — full remaining height */}
                  <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    <ReactFlow
                      nodes={nodes}
                      edges={edges}
                      onNodesChange={onNodesChange}
                      onEdgesChange={onEdgesChange}
                      onConnect={onConnect}
                      nodeTypes={nodeTypes}
                      edgeTypes={edgeTypes}
                      defaultEdgeOptions={{ type: 'dependencyEdge' }}
                      connectionMode={ConnectionMode.Loose}
                      fitView
                      fitViewOptions={{ padding: 0.35 }}
                      minZoom={0.15}
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

                      {/* Empty state */}
                      {!project && (
                        <div style={{
                          position:      'absolute',
                          top:           '50%',
                          left:          '50%',
                          transform:     'translate(-50%,-50%)',
                          textAlign:     'center',
                          color:         'rgba(255,255,255,0.18)',
                          fontSize:      13,
                          lineHeight:    1.6,
                          pointerEvents: 'none',
                        }}>
                          <div style={{ fontSize: 26, marginBottom: 8, opacity: 0.2 }}>⬡</div>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>No project open</div>
                          <div style={{ fontSize: 12, opacity: 0.7 }}>
                            Describe your idea in the Orchestrator →
                          </div>
                        </div>
                      )}
                    </ReactFlow>

                    {/* Phase swim lane labels — overlaid on canvas */}
                    {project && (
                      <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        pointerEvents: 'none',
                        zIndex: 5,
                      }}>
                        <ColumnLabels />
                      </div>
                    )}

                    {/* Session Tray */}
                    <SessionTray />

                    {/* All open FloatingChatCards */}
                    {openSessionIds.map(nodeId => (
                      <FloatingChatCard key={nodeId} nodeId={nodeId} />
                    ))}

                    {/* Dev Server Panel — bottom-left floating */}
                    {project && (
                      <div style={{
                        position: 'absolute',
                        bottom: 16,
                        left: 16,
                        zIndex: 100,
                        maxWidth: 360,
                        width: 'auto',
                      }}>
                        <DevServerPanel />
                      </div>
                    )}

                    {/* Reliability Bar — bottom-right floating */}
                    {project && (
                      <ReliabilityBar />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── RIGHT: orchestrator panel ── */}
        <OrchestratorPanel showChat={screen === 'canvas'} />
      </div>
    </>
  )
}
