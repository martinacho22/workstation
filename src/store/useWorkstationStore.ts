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
import {
  WorkstationNodeData,
  Project,
  ChatMessage,
  EdgeKind,
  HandoffDoc,
  BlueprintSection,
  BlockedReason,
  DeployTarget,
  EnvVar,
  ProjectContext,
} from '@/types'
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
  addBugNode: (parentId: string, description: string) => string
  addDeployNode: (target: DeployTarget) => string
  updateNodeStatus: (id: string, status: WorkstationNodeData['status'], blockedReason?: BlockedReason) => void
  minimizeNode: (id: string) => void
  restoreNode: (id: string) => void
  deleteNode: (id: string) => void
  renameNode: (id: string, label: string) => void
  resolveTangent: (tangentId: string, targetId: string) => void
  addChatMessage: (nodeId: string, msg: ChatMessage) => void
  generateHandoffDoc: (nodeId: string) => Promise<void>
  updateHandoffDoc: (nodeId: string, doc: HandoffDoc) => void
  addEnvVar: (nodeId: string, key: string) => void
  updateEnvVar: (nodeId: string, key: string, value: string) => void

  // Blueprint
  generateBlueprint: (idea: string) => Promise<void>
  applyBlueprint: (sections: BlueprintSection[]) => void
  blueprintLoading: boolean
  blueprintError: string | null

  // Context injection
  buildProjectContext: (nodeId?: string) => ProjectContext
  generateContextFile: (nodeId: string) => Promise<string>

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
    type:
      kind === 'handoff' ? 'handoffNode'
      : kind === 'overview' ? 'overviewNode'
      : kind === 'deploy' ? 'deployNode'
      : kind === 'bug' ? 'bugNode'
      : 'sectionNode',
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

async function callClaude(apiKey: string, model: string, prompt: string, maxTokens = 800): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const json = await res.json()
  return json.content?.[0]?.text || ''
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

      blueprintLoading: false,
      blueprintError: null,

      nodes: [makeNode('overview', 'Overview', { x: 80, y: 300 })],
      edges: [],
      activeNodeId: null,
      roadmapVisible: false,

      onNodesChange: (changes) =>
        set((s) => { s.nodes = applyNodeChanges(changes, s.nodes) as Node<WorkstationNodeData>[] }),

      onEdgesChange: (changes) =>
        set((s) => { s.edges = applyEdgeChanges(changes, s.edges) }),

      setActiveNode: (id) => set((s) => { s.activeNodeId = id }),
      toggleRoadmap: () => set((s) => { s.roadmapVisible = !s.roadmapVisible }),

      // ─── Add Nodes ────────────────────────────────────────────────────────

      addSectionNode: (label, position) => {
        const nodes = get().nodes
        const rightmost = nodes.reduce((max, n) => Math.max(max, n.position.x), 0)
        const pos = position || { x: rightmost + 520, y: 300 }
        const node = makeNode('section', label, pos)

        const mainNodes = nodes.filter(n =>
          (n.data.kind === 'section' || n.data.kind === 'overview') &&
          n.data.status !== 'minimized'
        )
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

        // Auto-generate context file for the new section
        setTimeout(() => get().generateContextFile(node.id), 300)

        return node.id
      },

      addTangentNode: (parentId, label) => {
        const parent = get().nodes.find(n => n.id === parentId)
        if (!parent) return ''

        const existingTangents = get().nodes.filter(n => n.data.parentId === parentId && n.data.kind === 'tangent')
        const xOffset = existingTangents.length * 280
        const pos = { x: parent.position.x + xOffset, y: parent.position.y + 360 }
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

        setTimeout(() => get().generateContextFile(node.id), 300)
        return node.id
      },

      addBugNode: (parentId, description) => {
        const parent = get().nodes.find(n => n.id === parentId)
        if (!parent) return ''

        const existingBugs = get().nodes.filter(n => n.data.parentId === parentId && n.data.kind === 'bug')
        const xOffset = existingBugs.length * 280
        const pos = { x: parent.position.x + xOffset, y: parent.position.y + 360 }
        const node = makeNode('bug', `Bug: ${description.slice(0, 30)}`, pos, {
          parentId,
          bugDescription: description,
          bugAffectedSection: parent.data.label,
        })

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

      addDeployNode: (target) => {
        const nodes = get().nodes
        const rightmost = nodes.reduce((max, n) => Math.max(max, n.position.x), 0)
        const pos = { x: rightmost + 560, y: 300 }

        const defaultEnvVars: EnvVar[] = [
          { key: 'NODE_ENV', value: 'production', isSet: true },
          { key: 'DATABASE_URL', value: '', isSet: false },
          { key: 'API_SECRET', value: '', isSet: false },
        ]

        const node = makeNode('deploy', `Deploy → ${target}`, pos, {
          deployTarget: target,
          deployStatus: 'idle',
          envVars: defaultEnvVars,
          skills: DEFAULT_SKILLS.map(s => ({
            ...s,
            enabled: s.id === 'deployment' || s.id === 'memory',
          })),
        })

        const mainNodes = nodes.filter(n =>
          (n.data.kind === 'section' || n.data.kind === 'overview') &&
          n.data.status !== 'minimized'
        )
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

      // ─── Node Actions ─────────────────────────────────────────────────────

      updateNodeStatus: (id, status, blockedReason) =>
        set((s) => {
          const node = s.nodes.find(n => n.id === id)
          if (node) {
            node.data.status = status
            if (status === 'blocked' && blockedReason) {
              node.data.blockedReason = blockedReason
            } else if (status !== 'blocked') {
              delete node.data.blockedReason
            }
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

      addEnvVar: (nodeId, key) =>
        set((s) => {
          const node = s.nodes.find(n => n.id === nodeId)
          if (node) {
            if (!node.data.envVars) node.data.envVars = []
            node.data.envVars.push({ key, value: '', isSet: false })
          }
        }),

      updateEnvVar: (nodeId, key, value) =>
        set((s) => {
          const node = s.nodes.find(n => n.id === nodeId)
          if (node?.data.envVars) {
            const v = node.data.envVars.find(e => e.key === key)
            if (v) {
              v.value = value
              v.isSet = value.trim().length > 0
            }
          }
        }),

      // ─── Blueprint Generator ───────────────────────────────────────────────

      generateBlueprint: async (idea: string) => {
        const state = get()
        const apiKey = state.apiKey
        if (!apiKey) {
          state.showApiKeyModal()
          return
        }

        set((s) => { s.blueprintLoading = true; s.blueprintError = null })

        const prompt = `You are a senior software architect. A developer has described their project idea. Break it into logical build sections.

Project idea: "${idea}"

Return ONLY a JSON array of sections (no markdown, no explanation):
[
  {
    "label": "Section Name",
    "description": "What this section does and what needs to be built",
    "dependsOn": ["Other Section Label"]
  }
]

Rules:
- 4-8 sections max
- Start with foundational sections (setup, auth, DB) before features
- "dependsOn" should list section labels this section requires first
- Be specific and actionable
- Always include a "Project Setup" section first
- Always end with a "Deploy" section or the user will add a deploy node separately`

        try {
          const text = await callClaude(apiKey, 'claude-haiku-4-5', prompt, 1200)
          const match = text.match(/\[[\s\S]*\]/)
          if (!match) throw new Error('No JSON array found in response')

          const sections: BlueprintSection[] = JSON.parse(match[0])
          get().applyBlueprint(sections)
          set((s) => { s.blueprintLoading = false })
        } catch (err) {
          set((s) => {
            s.blueprintLoading = false
            s.blueprintError = err instanceof Error ? err.message : 'Blueprint generation failed'
          })
        }
      },

      applyBlueprint: (sections: BlueprintSection[]) => {
        const store = get()
        if (store.project) {
          set((s) => {
            if (s.project) s.project.blueprint = sections
          })
        }

        // Place sections left to right, 520px apart, starting after overview
        sections.forEach((section, i) => {
          store.addSectionNode(section.label, { x: 600 + i * 520, y: 300 })
        })
      },

      // ─── Context Injection ─────────────────────────────────────────────────

      buildProjectContext: (nodeId?: string): ProjectContext => {
        const state = get()
        const project = state.project
        const nodes = state.nodes

        const sectionNodes = nodes.filter(n =>
          n.data.kind === 'section' || n.data.kind === 'overview'
        )

        const openTangents = nodes
          .filter(n => (n.data.kind === 'tangent' || n.data.kind === 'bug') && n.data.status !== 'done')
          .map(n => ({
            label: n.data.label,
            parentSection: nodes.find(p => p.id === n.data.parentId)?.data.label || 'unknown',
          }))

        const currentNode = nodeId ? nodes.find(n => n.id === nodeId) : undefined

        return {
          projectName: project?.name || 'Untitled Project',
          projectDescription: project?.description || '',
          stack: project?.stack || '',
          deployTarget: project?.deployTarget || 'none',
          sections: sectionNodes.map(n => ({
            label: n.data.label,
            status: n.data.status,
            description: project?.blueprint?.find(b => b.label === n.data.label)?.description,
          })),
          adrs: (project?.adrs || []).map(a => ({
            title: a.title,
            decision: a.decision,
            reason: a.reason,
          })),
          currentSection: currentNode?.data.label,
          currentSectionPurpose: project?.blueprint?.find(b => b.label === currentNode?.data.label)?.description,
          openTangents,
          handoffSummary: currentNode?.data.handoffDoc
            ? `Last session: ${currentNode.data.handoffDoc.currentStatus}. Next: ${currentNode.data.handoffDoc.nextSteps}`
            : undefined,
        }
      },

      generateContextFile: async (nodeId: string): Promise<string> => {
        const ctx = get().buildProjectContext(nodeId)

        const contextFile = `# Workstation Context File
# Auto-generated — do not edit manually
# Injected at the start of every Claude Code session for this section

## Project
- Name: ${ctx.projectName}
- Description: ${ctx.projectDescription}
- Stack: ${ctx.stack}
- Deploy Target: ${ctx.deployTarget}

## Current Section
- Working on: ${ctx.currentSection || 'Overview'}
${ctx.currentSectionPurpose ? `- Purpose: ${ctx.currentSectionPurpose}` : ''}
${ctx.handoffSummary ? `- Last session summary: ${ctx.handoffSummary}` : '- First session in this section'}

## All Sections
${ctx.sections.map(s => `- [${s.status === 'done' ? '✓' : s.status === 'blocked' ? '⚠' : ' '}] ${s.label}${s.description ? ': ' + s.description : ''}`).join('\n')}

## Architecture Decisions
${ctx.adrs.length > 0
  ? ctx.adrs.map(a => `- ${a.title}: ${a.decision} (${a.reason})`).join('\n')
  : '- No architecture decisions recorded yet'}

## Open Tangents / Bugs
${ctx.openTangents.length > 0
  ? ctx.openTangents.map(t => `- ${t.label} (from: ${t.parentSection})`).join('\n')
  : '- None'}

## Instructions
You are helping build the "${ctx.currentSection || 'Overview'}" section of ${ctx.projectName}.
Stack: ${ctx.stack}.
${ctx.currentSectionPurpose ? `Your goal for this section: ${ctx.currentSectionPurpose}` : ''}
Write production-quality code. Be concise. Ask before making large structural changes.`

        set((s) => {
          const node = s.nodes.find(n => n.id === nodeId)
          if (node) node.data.contextFile = contextFile
        })

        return contextFile
      },

      // ─── Handoff Doc ──────────────────────────────────────────────────────

      generateHandoffDoc: async (nodeId: string) => {
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
          const text = await callClaude(apiKey, 'claude-haiku-4-5', prompt, 600)
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

          // Refresh context file with new handoff summary
          setTimeout(() => get().generateContextFile(nodeId), 200)

          // Spawn handoff node below if not already exists
          const alreadyHasHandoff = state.nodes.some(
            n => n.data.kind === 'handoff' && n.data.parentId === nodeId
          )
          if (!alreadyHasHandoff) {
            const parent = state.nodes.find(n => n.id === nodeId)!
            const handoffNode = makeNode('handoff', `${node.data.label} — Handoff`, {
              x: parent.position.x,
              y: parent.position.y + 360,
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
      partialize: (s) => ({
        project: s.project,
        nodes: s.nodes,
        edges: s.edges,
        apiKey: s.apiKey,
      }),
    }
  )
)
