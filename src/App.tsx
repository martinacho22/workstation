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
import ElectronHeader    from '@/components/layout/ElectronHeader'
import Dashboard         from '@/screens/Dashboard'
import WarRoom           from '@/screens/WarRoom'
import Settings          from '@/screens/Settings'
import Setup             from '@/screens/Setup'

// ─── Constants ────────────────────────────────────────────────────────────────

const HEADER_H    = 40
const SETUP_DONE_KEY = 'workstation_setup_complete'

const nodeTypes: NodeTypes = {
  sectionNode:  SectionNode,
  overviewNode: OverviewNode,
}
const edgeTypes: EdgeTypes = {
  flowEdge: FlowEdge,
}

// ─── Top-level nav ────────────────────────────────────────────────────────────

type Screen = 'canvas' | 'dashboard' | 'warroom' | 'settings'

function NavBar({ screen, onChange }: { screen: Screen; onChange: (s: Screen) => void }) {
  const items: { id: Screen; label: string }[] = [
    { id: 'canvas',    label: 'Canvas'    },
    { id: 'dashboard', label: 'Projects'  },
    { id: 'warroom',   label: 'War Room'  },
    { id: 'settings',  label: 'Settings'  },
  ]
  return (
    <div style={{
      position: 'absolute',
      top: 12,
      right: 16,
      display: 'flex',
      gap: 4,
      zIndex: 200,
    }}>
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            border: '1px solid',
            borderColor: screen === item.id ? 'rgba(0,255,136,0.4)' : 'rgba(255,255,255,0.08)',
            background: screen === item.id ? 'rgba(0,255,136,0.1)' : 'transparent',
            color: screen === item.id ? 'var(--accent, #00ff88)' : 'rgba(255,255,255,0.4)',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.04em',
            WebkitAppRegion: 'no-drag',
          } as React.CSSProperties}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

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

  // ── CLI setup wizard (first launch) ──────────────────────────────────────
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

      {/* Nav overlay — top right */}
      <NavBar screen={screen} onChange={(s) => {
        if (s !== 'canvas') setActiveNode(null)
        setScreen(s)
      }} />

      {/* ── Main layout ── */}
      <div style={{
        display: 'flex',
        width: '100vw',
        height: `calc(100vh - ${HEADER_H}px)`,
        marginTop: HEADER_H,
        overflow: 'hidden',
        background: 'var(--bg, #0d0d14)',
      }}>

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

        {/* ── Canvas + Session — LEFT side takes all remaining space ── */}
        {screen === 'canvas' && (
          <div style={{ flex: 1, height: '100%', position: 'relative', overflow: 'hidden' }}>

            {/* Project setup wizard */}
            {showSetup && !project ? (
              <ProjectSetup onDone={() => setShowSetup(false)} />
            ) : (
              <>
                {/* Canvas — fades when session is open */}
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
                    <Controls style={{
                      background: 'var(--surface, rgba(255,255,255,0.05))',
                      border: '1px solid var(--border, rgba(255,255,255,0.08))',
                      borderRadius: 8,
                    }} />
                    <MiniMap
                      style={{
                        background: 'var(--surface, rgba(255,255,255,0.03))',
                        border: '1px solid var(--border, rgba(255,255,255,0.06))',
                        borderRadius: 8,
                      }}
                      nodeColor={(n) => {
                        if (n.data?.status === 'done')    return 'rgba(74,222,128,0.6)'
                        if (n.data?.status === 'blocked') return 'rgba(240,192,64,0.6)'
                        if (n.data?.status === 'active')  return 'rgba(0,255,136,0.6)'
                        if (n.data?.kind   === 'overview')return 'var(--accent, #00ff88)'
                        return 'rgba(255,255,255,0.08)'
                      }}
                      maskColor="rgba(10,10,15,0.7)"
                    />
                    <Panel position="top-center" style={{ marginTop: 8 }}>
                      <Toolbar onNewProject={() => setShowSetup(true)} />
                    </Panel>
                  </ReactFlow>
                </div>

                {/* Session view overlay */}
                {sessionOpen && (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
                    <SessionView />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Orchestrator Panel — RIGHT side, canvas only ── */}
        {screen === 'canvas' && <OrchestratorPanel />}

        {/* ── War Room ── */}
        {screen === 'warroom' && <WarRoom />}

        {/* ── Settings ── */}
        {screen === 'settings' && <Settings />}

      </div>
    </>
  )
}
