import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist, temporal } from 'zustand/middleware'
import {
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react'
import { WorkstationNodeData, Project, ChatMessage, EdgeKind, HandoffDoc } from '@/types'
import { nanoid } from 'nanoid'

interface WorkstationState {
  // Project
  project: Project | null
  setProject: (p: Project) => void

  // API Key
  apiKey: string
  setApiKey: (key: string) => void

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
  deleteNode: (id: string) => void
  renameNode: (id: string, label: string) => void
  resolveTangent: (tangentId: string, targetId: string) => void
  addChatMessage: (nodeId: string, msg: ChatMessage) => void
  generateHandoffDoc: (nodeId: string) => Promise<void>
  updateHandoffDoc: (nodeId: string, doc: HandoffDoc) => void

  // Active node
  activeNodeId: string | null
  setActiveNode: (id: string | null) => void

  // Roadmap overlay
  roadmapVisible: boolean
  toggleRoadmap: () => void

  // API key modal
  apiKeyModalVisible: boolean
  showApiKeyModal: () => void
  hideApiKeyModal: () => void
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

      apiKey: '',
      setApiKey: (key) => set((s) => { s.apiKey = key }),

      apiKeyModalVisible: false,
      showApiKeyModal: () => set((s) => { s.apiKeyModalVisible = true }),
      hideApiKeyModal: () => set((s) => { s.apiKeyModalVisible = false }),

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

        // Offset tangents horizontally if multiple exist from same parent
        const existingTangents = get().nodes.filter(n => n.data.parentId === parentId)
        const xOffset = existingTangents.length * 260
        const pos = { x: parent.position.x + xOffset, y: parent.position.y + 340 }
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
          const tangent = s.nodes.find(n => n.id === tangentId)
          if (tangent) {
            tangent.data.resolvedTo = targetId
            tangent.data.status = 'done'
          }

          const openEdge = s.edges.find(e => e.target === tangentId)
          if (openEdge) openEdge.data = { kind: 'tangent-resolved' as EdgeKind }

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

      deleteNode: (id) =>
        set((s) => {
          s.nodes = s.nodes.filter(n => n.id !== id)
          s.edges = s.edges.filter(e => e.source !== id && e.target !== id)
          if (s.activeNodeId === id) s.activeNodeId = null
        }),

      renameNode: (id, label) =>
        set((s) => {
          const node = s.nodes.find(n => n.id === id)
          if (node && label.trim()) {
            node.data.label = label.trim()
            node.data.updatedAt = Date.now()
          }
        }),

      addChatMessage: (nodeId, msg) =>
        set((s) => {
          const node = s.nodes.find(n => n.id === nodeId)
          if (node) {
            node.data.chatHistory.push(msg)
            node.data.updatedAt = Date.now()
          }
        }),

      updateHandoffDoc: (nodeId, doc) =>
        set((s) => {
          const node = s.nodes.find(n => n.id === nodeId)
          if (!node) return
          const existing = node.data.handoffDoc
          if (existing) {
            existing.versions.push({ timestamp: Date.now(), snapshot: { ...existing, versions: [] } })
            Object.assign(existing, doc)
          } else {
            node.data.handoffDoc = { ...doc, versions: [] }
          }
          node.data.updatedAt = Date.now()
        }),

      generateHandoffDoc: async (nodeId) => {
        const state = get()
        const node = state.nodes.find(n => n.id === nodeId)
        if (!node) return

        const apiKey = state.apiKey
        if (!apiKey) {
          state.showApiKeyModal()
          return
        }

        const history = node.data.chatHistory
        if (history.length === 0) return

        const prompt = `You are a technical writer. Based on this chat history from a coding session for section "${node.data.label}", generate a concise handoff document.

Chat history:
${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

Return a JSON object with these exact fields:
{
  "whatWasBuilt": "...",
  "decisionsMAde": "...",
  "currentStatus": "...",
  "nextSteps": "...",
  "filesChanged": ["file1.ts", "file2.ts"]
}

Be concise and specific. Focus on what a developer needs to pick this back up cold.`

        try {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
              'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5',
              max_tokens: 600,
              messages: [{ role: 'user', content: prompt }],
            }),
          })

          const json = await res.json()
          const text = json.content?.[0]?.text || ''
          const match = text.match(/\{[\s\S]*\}/)
          if (!match) return

          const parsed = JSON.parse(match[0])
          const doc: HandoffDoc = {
            nodeId,
            nodeLabel: node.data.label,
            lastUpdated: Date.now(),
            whatWasBuilt: parsed.whatWasBuilt || '',
            decisionsMAde: parsed.decisionsMAde || '',
            currentStatus: parsed.currentStatus || '',
            nextSteps: parsed.nextSteps || '',
            filesChanged: parsed.filesChanged || [],
            versions: [],
          }

          get().updateHandoffDoc(nodeId, doc)

          // Spawn handoff node below if not already exists
          const alreadyHasHandoff = state.nodes.some(
            n => n.data.kind === 'handoff' && n.data.parentId === nodeId
          )
          if (!alreadyHasHandoff) {
            const parent = state.nodes.find(n => n.id === nodeId)!
            const handoffNode = makeNode('handoff', `${node.data.label} — Handoff`, {
              x: parent.position.x,
              y: parent.position.y + 340,
            }, { parentId: nodeId, handoffDoc: doc })

            set((s) => {
              s.nodes.push(handoffNode)
              s.edges.push({
                id: nanoid(6),
                source: nodeId,
                target: handoffNode.id,
                type: 'tangentEdge',
                data: { kind: 'tangent-resolved' as EdgeKind },
              })
            })
          }
        } catch (err) {
          console.error('Handoff doc generation failed:', err)
        }
      },
    })),
    {
      name: 'workstation-store',
      partialize: (s) => ({ project: s.project, nodes: s.nodes, edges: s.edges, apiKey: s.apiKey }),
    }
  )
)
