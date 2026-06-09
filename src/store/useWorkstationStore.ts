import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react'
import { WorkstationNodeData, Project, ChatMessage, EdgeKind } from '@/types'
import { nanoid } from 'nanoid'

interface WorkstationState {
  // Project
  project: Project | null
  setProject: (p: Project) => void

  // Canvas
  nodes: Node<WorkstationNodeData>[]
  edges: Edge[]
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void

  // Node actions
  addSectionNode: (label: string, position?: { x: number; y: number }) => string
  addTangentNode: (parentId: string, label: string) => string
  updateNodeStatus: (id: string, status: WorkstationNodeData['status']) => void
  minimizeNode: (id: string) => void
  restoreNode: (id: string) => void
  resolveTangent: (tangentId: string, targetId: string) => void
  addChatMessage: (nodeId: string, msg: ChatMessage) => void

  // Active node
  activeNodeId: string | null
  setActiveNode: (id: string | null) => void

  // Roadmap overlay
  roadmapVisible: boolean
  toggleRoadmap: () => void
}

const DEFAULT_SKILLS = [
  { id: 'memory' as const, label: 'Project Memory', enabled: true },
  { id: 'web_search' as const, label: 'Web Search', enabled: false },
  { id: 'code_review' as const, label: 'Code Review', enabled: true },
  { id: 'architecture' as const, label: 'Architecture', enabled: false },
  { id: 'debugging' as const, label: 'Debugging', enabled: true },
  { id: 'documentation' as const, label: 'Docs', enabled: false },
  { id: 'testing' as const, label: 'Testing', enabled: false },
  { id: 'deployment' as const, label: 'Deploy', enabled: false },
]

function makeNode(
  kind: WorkstationNodeData['kind'],
  label: string,
  position: { x: number; y: number },
  extra: Partial<WorkstationNodeData> = {}
): Node<WorkstationNodeData> {
  const id = nanoid(8)
  return {
    id,
    type: kind === 'handoff' ? 'handoffNode' : kind === 'overview' ? 'overviewNode' : 'sectionNode',
    position,
    data: {
      id,
      kind,
      label,
      status: 'idle',
      chatHistory: [],
      skills: DEFAULT_SKILLS.map(s => ({ ...s })),
      skipPermissions: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...extra,
    },
  }
}

export const useWorkstationStore = create<WorkstationState>()(
  persist(
    immer((set, get) => ({
      project: null,
      setProject: (p) => set((s) => { s.project = p }),

      nodes: [
        makeNode('overview', 'Overview', { x: 80, y: 300 }),
      ],
      edges: [],
      activeNodeId: null,
      roadmapVisible: false,

      onNodesChange: (changes) =>
        set((s) => { s.nodes = applyNodeChanges(changes, s.nodes) as Node<WorkstationNodeData>[] }),

      onEdgesChange: (changes) =>
        set((s) => { s.edges = applyEdgeChanges(changes, s.edges) }),

      setActiveNode: (id) => set((s) => { s.activeNodeId = id }),

      toggleRoadmap: () => set((s) => { s.roadmapVisible = !s.roadmapVisible }),

      addSectionNode: (label, position) => {
        const nodes = get().nodes
        const rightmost = nodes.reduce((max, n) => Math.max(max, n.position.x), 0)
        const pos = position || { x: rightmost + 520, y: 300 }
        const node = makeNode('section', label, pos)

        // Connect from last main-flow node
        const mainNodes = nodes.filter(n => n.data.kind === 'section' || n.data.kind === 'overview')
        const lastMain = mainNodes[mainNodes.length - 1]

        set((s) => {
          s.nodes.push(node)
          if (lastMain) {
            s.edges.push({
              id: nanoid(6),
              source: lastMain.id,
              target: node.id,
              type: 'flowEdge',
              data: { kind: 'flow' as EdgeKind },
            })
          }
        })

        return node.id
      },

      addTangentNode: (parentId, label) => {
        const parent = get().nodes.find(n => n.id === parentId)
        if (!parent) return ''

        const pos = { x: parent.position.x, y: parent.position.y + 320 }
        const node = makeNode('tangent', label, pos, { parentId })

        set((s) => {
          s.nodes.push(node)
          s.edges.push({
            id: nanoid(6),
            source: parentId,
            target: node.id,
            type: 'tangentEdge',
            data: { kind: 'tangent-open' as EdgeKind },
          })
        })

        return node.id
      },

      resolveTangent: (tangentId, targetId) => {
        set((s) => {
          // Update tangent node
          const tangent = s.nodes.find(n => n.id === tangentId)
          if (tangent) {
            tangent.data.resolvedTo = targetId
            tangent.data.status = 'done'
          }

          // Update open tangent edge
          const openEdge = s.edges.find(
            e => e.source === tangent?.data.parentId && e.target === tangentId
          )
          if (openEdge) openEdge.data = { kind: 'tangent-resolved' as EdgeKind }

          // Add tieback edge
          s.edges.push({
            id: nanoid(6),
            source: tangentId,
            target: targetId,
            type: 'tiebackEdge',
            data: { kind: 'tieback' as EdgeKind },
          })
        })
      },

      updateNodeStatus: (id, status) =>
        set((s) => {
          const node = s.nodes.find(n => n.id === id)
          if (node) {
            node.data.status = status
            node.data.updatedAt = Date.now()
          }
        }),

      minimizeNode: (id) =>
        set((s) => {
          const node = s.nodes.find(n => n.id === id)
          if (node) node.data.status = 'minimized'
        }),

      restoreNode: (id) =>
        set((s) => {
          const node = s.nodes.find(n => n.id === id)
          if (node) node.data.status = 'idle'
        }),

      addChatMessage: (nodeId, msg) =>
        set((s) => {
          const node = s.nodes.find(n => n.id === nodeId)
          if (node) {
            node.data.chatHistory.push(msg)
            node.data.updatedAt = Date.now()
          }
        }),
    })),
    {
      name: 'workstation-store',
      partialize: (s) => ({ project: s.project, nodes: s.nodes, edges: s.edges }),
    }
  )
)
