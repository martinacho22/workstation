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
  ProjectMeta,
  ChatMessage,
  EdgeKind,
  HandoffDoc,
  BlueprintSection,
  BlockedReason,
  DeployTarget,
  EnvVar,
  ProjectContext,
  ArchitectureDecisionRecord,
  CompletionChecklistItem,
} from '@/types'
import { nanoid } from 'nanoid'
import { runClaude } from '@/lib/claudeRunner'

interface WorkstationState {
  projects: Project[]
  activeProjectId: string | null
  createProject: (p: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => string
  switchProject: (id: string) => void
  deleteProject: (id: string) => void
  getProjectMetas: () => ProjectMeta[]

  project: Project | null
  setProject: (p: Project) => void

  addAdr: (title: string, decision: string, reason: string) => void
  deleteAdr: (id: string) => void

  generateChecklist: () => Promise<void>
  toggleChecklistItem: (id: string) => void
  checklistLoading: boolean

  // API key is now optional — only used as fallback if CLI unavailable
  apiKey: string
  setApiKey: (key: string) => void

  // Claude CLI path (persisted)
  claudeCliPath: string
  setClaudeCliPath: (p: string) => void

  nodes: Node<WorkstationNodeData>[]
  edges: Edge[]
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void

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
  setDefinitionOfDone: (nodeId: string, dod: string) => void

  generateBlueprint: (idea: string) => Promise<void>
  applyBlueprint: (sections: BlueprintSection[]) => void
  blueprintLoading: boolean
  blueprintError: string | null

  buildProjectContext: (nodeId?: string) => ProjectContext
  generateContextFile: (nodeId: string) => Promise<string>

  exportFinalHandoff: () => string

  activeNodeId: string | null
  setActiveNode: (id: string | null) => void

  roadmapVisible: boolean
  toggleRoadmap: () => void

  apiKeyModalVisible: boolean
  showApiKeyModal: () => void
  hideApiKeyModal: () => void
}

const DEFAULT_SKILLS = [
  { id: 'memory' as const,        label: 'Project Memory',  enabled: true  },
  { id: 'web_search' as const,    label: 'Web Search',      enabled: false },
  { id: 'code_review' as const,   label: 'Code Review',     enabled: true  },
  { id: 'architecture' as const,  label: 'Architecture',    enabled: false },
  { id: 'debugging' as const,     label: 'Debugging',       enabled: true  },
  { id: 'documentation' as const, label: 'Docs',            enabled: false },
  { id: 'testing' as const,       label: 'Testing',         enabled: false },
  { id: 'deployment' as const,    label: 'Deploy',          enabled: false },
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
      kind === 'handoff'  ? 'handoffNode'
      : kind === 'overview' ? 'overviewNode'
      : kind === 'deploy'   ? 'deployNode'
      : kind === 'bug'      ? 'bugNode'
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

const INITIAL_NODES: Node<WorkstationNodeData>[] = [
  makeNode('overview', 'Overview', { x: 80, y: 300 }),
]

export const useWorkstationStore = create<WorkstationState>()(
  persist(
    immer((set, get) => ({
      // ─── Multi-project ────────────────────────────────────────────────────

      projects: [],
      activeProjectId: null,

      createProject: (p) => {
        const id = nanoid(10)
        const now = Date.now()
        const newProject: Project = { ...p, id, createdAt: now, updatedAt: now }
        set((s) => {
          s.projects.push(newProject)
          s.activeProjectId = id
          s.project = newProject
          s.nodes = [makeNode('overview', 'Overview', { x: 80, y: 300 })]
          s.edges = []
          s.activeNodeId = null
        })
        return id
      },

      switchProject: (id) => {
        const state = get()
        if (state.activeProjectId) {
          set((s) => {
            const current = s.projects.find(p => p.id === s.activeProjectId)
            if (current) {
              current.nodes = s.nodes as unknown[]
              current.edges = s.edges as unknown[]
              current.updatedAt = Date.now()
            }
          })
        }
        set((s) => {
          const target = s.projects.find(p => p.id === id)
          if (target) {
            s.activeProjectId = id
            s.project = target
            s.nodes = (target.nodes as Node<WorkstationNodeData>[]) ?? [makeNode('overview', 'Overview', { x: 80, y: 300 })]
            s.edges = (target.edges as Edge[]) ?? []
            s.activeNodeId = null
          }
        })
      },

      deleteProject: (id) => {
        set((s) => {
          s.projects = s.projects.filter(p => p.id !== id)
          if (s.activeProjectId === id) {
            s.activeProjectId = null
            s.project = null
            s.nodes = [makeNode('overview', 'Overview', { x: 80, y: 300 })]
            s.edges = []
          }
        })
      },

      getProjectMetas: () => {
        const { projects, nodes } = get()
        return projects.map((p) => {
          const projectNodes = p.id === get().activeProjectId
            ? nodes
            : (p.nodes as Node<WorkstationNodeData>[]) ?? []

          const sectionNodes = projectNodes.filter(n => n.data?.kind === 'section')
          const done         = sectionNodes.filter(n => n.data?.status === 'done').length
          const blocked      = sectionNodes.filter(n => n.data?.status === 'blocked').length
          const bugNodes     = projectNodes.filter(n => n.data?.kind === 'bug' && n.data?.status !== 'done')
          const tangentNodes = projectNodes.filter(n => n.data?.kind === 'tangent' && !n.data?.resolvedTo)
          const total        = sectionNodes.length
          const progress     = total > 0 ? Math.round((done / total) * 100) : 0

          let status: ProjectMeta['status'] = 'idle'
          if (blocked > 0) status = 'blocked'
          else if (done === total && total > 0) status = 'done'
          else if (sectionNodes.some(n => n.data?.status === 'active')) status = 'active'
          else if (total > 0) status = 'active'

          return {
            id: p.id,
            name: p.name,
            description: p.description,
            stack: p.stack,
            deployTarget: p.deployTarget,
            accentColor: p.accentColor,
            progress,
            sectionsTotal: total,
            sectionsDone: done,
            openBugs: bugNodes.length,
            openTangents: tangentNodes.length,
            lastActive: p.updatedAt,
            status,
          } satisfies ProjectMeta
        })
      },

      // ─── Current project ──────────────────────────────────────────────────

      project: null,
      setProject: (p) => set((s) => {
        s.project = p
        const idx = s.projects.findIndex(x => x.id === p.id)
        if (idx >= 0) s.projects[idx] = p
        else s.projects.push(p)
        s.activeProjectId = p.id
      }),

      // ─── ADRs ─────────────────────────────────────────────────────────────

      addAdr: (title, decision, reason) => set((s) => {
        if (!s.project) return
        if (!s.project.adrs) s.project.adrs = []
        s.project.adrs.push({ id: nanoid(6), title, decision, reason, createdAt: Date.now() })
        s.project.updatedAt = Date.now()
        const idx = s.projects.findIndex(p => p.id === s.project?.id)
        if (idx >= 0) s.projects[idx] = s.project
      }),

      deleteAdr: (id) => set((s) => {
        if (!s.project?.adrs) return
        s.project.adrs = s.project.adrs.filter(a => a.id !== id)
        const idx = s.projects.findIndex(p => p.id === s.project?.id)
        if (idx >= 0) s.projects[idx] = s.project!
      }),

      // ─── Completion checklist ─────────────────────────────────────────────

      checklistLoading: false,

      generateChecklist: async () => {
        const state = get()
        if (!state.project) return

        set((s) => { s.checklistLoading = true })

        const sectionLabels = state.nodes
          .filter(n => n.data?.kind === 'section')
          .map(n => n.data.label)

        const prompt = `You are a senior developer. Given these sections of a project called "${state.project.name}" (${state.project.stack}), generate a completion checklist.

Sections: ${sectionLabels.join(', ')}

Return ONLY a JSON array:
[
  { "label": "Checklist item description", "sectionId": "optional section label or null" }
]

Rules:
- 8-14 items total
- Cover: code complete, tests, env vars set, deploy working, error handling, README updated, live URL verified
- Be specific and actionable
- No markdown, no explanation — just the JSON array`

        try {
          const text = await runClaude(prompt, {
            apiKey: state.apiKey,
            maxTokens: 800,
          })

          const match = text.match(/\[[\s\S]*\]/)
          if (!match) throw new Error('No JSON array')

          const items: { label: string; sectionId?: string }[] = JSON.parse(match[0])
          const checklist: CompletionChecklistItem[] = items.map(item => ({
            id: nanoid(6),
            label: item.label,
            done: false,
            sectionId: item.sectionId ?? undefined,
          }))

          set((s) => {
            if (s.project) {
              s.project.completionChecklist = checklist
              s.project.updatedAt = Date.now()
              const idx = s.projects.findIndex(p => p.id === s.project?.id)
              if (idx >= 0) s.projects[idx] = s.project!
            }
            s.checklistLoading = false
          })
        } catch {
          set((s) => { s.checklistLoading = false })
        }
      },

      toggleChecklistItem: (id) => set((s) => {
        if (!s.project?.completionChecklist) return
        const item = s.project.completionChecklist.find(i => i.id === id)
        if (item) item.done = !item.done
        const idx = s.projects.findIndex(p => p.id === s.project?.id)
        if (idx >= 0) s.projects[idx] = s.project!
      }),

      // ─── API Key (optional fallback) ──────────────────────────────────────

      apiKey: '',
      setApiKey: (key) => set((s) => { s.apiKey = key }),

      // ─── Claude CLI path ──────────────────────────────────────────────────

      claudeCliPath: 'claude',
      setClaudeCliPath: (p) => {
        set((s) => { s.claudeCliPath = p || 'claude' })
        // Notify main process
        const electronAPI = (window as any).electron
        if (electronAPI?.claude?.setPath) electronAPI.claude.setPath(p || 'claude')
      },

      apiKeyModalVisible: false,
      showApiKeyModal: () => set((s) => { s.apiKeyModalVisible = true }),
      hideApiKeyModal: () => set((s) => { s.apiKeyModalVisible = false }),

      blueprintLoading: false,
      blueprintError: null,

      nodes: INITIAL_NODES,
      edges: [],
      activeNodeId: null,
      roadmapVisible: false,

      onNodesChange: (changes) =>
        set((s) => { s.nodes = applyNodeChanges(changes, s.nodes) as Node<WorkstationNodeData>[] }),

      onEdgesChange: (changes) =>
        set((s) => { s.edges = applyEdgeChanges(changes, s.edges) }),

      setActiveNode: (id) => set((s) => { s.activeNodeId = id }),
      toggleRoadmap: () => set((s) => { s.roadmapVisible = !s.roadmapVisible }),

      // ─── Add nodes ─────────────────────────────────────────────────────────

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
          s.edges.push({ id: nanoid(6), source: parentId, target: node.id, type: 'tangentEdge', data: { kind: 'tangent-open' as EdgeKind } })
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
        const node = makeNode('bug', `Bug: ${description.slice(0, 30)}`, pos, { parentId, bugDescription: description, bugAffectedSection: parent.data.label })
        set((s) => {
          s.nodes.push(node)
          s.edges.push({ id: nanoid(6), source: parentId, target: node.id, type: 'tangentEdge', data: { kind: 'tangent-open' as EdgeKind } })
        })
        return node.id
      },

      addDeployNode: (target) => {
        const nodes = get().nodes
        const rightmost = nodes.reduce((max, n) => Math.max(max, n.position.x), 0)
        const pos = { x: rightmost + 560, y: 300 }
        const defaultEnvVars: EnvVar[] = [
          { key: 'NODE_ENV',     value: 'production', isSet: true  },
          { key: 'DATABASE_URL', value: '',           isSet: false },
          { key: 'API_SECRET',   value: '',           isSet: false },
        ]
        const node = makeNode('deploy', `Deploy → ${target}`, pos, {
          deployTarget: target,
          deployStatus: 'idle',
          envVars: defaultEnvVars,
          skills: DEFAULT_SKILLS.map(s => ({ ...s, enabled: s.id === 'deployment' || s.id === 'memory' })),
        })
        const mainNodes = nodes.filter(n => (n.data.kind === 'section' || n.data.kind === 'overview') && n.data.status !== 'minimized')
        const lastMain = mainNodes[mainNodes.length - 1]
        set((s) => {
          s.nodes.push(node)
          if (lastMain) s.edges.push({ id: nanoid(6), source: lastMain.id, target: node.id, type: 'flowEdge', data: { kind: 'flow' as EdgeKind } })
        })
        return node.id
      },

      // ─── Node actions ──────────────────────────────────────────────────────

      updateNodeStatus: (id, status, blockedReason) =>
        set((s) => {
          const node = s.nodes.find(n => n.id === id)
          if (node) {
            node.data.status = status
            if (status === 'blocked' && blockedReason) node.data.blockedReason = blockedReason
            else if (status !== 'blocked') delete node.data.blockedReason
            node.data.updatedAt = Date.now()
          }
        }),

      minimizeNode: (id) => set((s) => { const n = s.nodes.find(n => n.id === id); if (n) n.data.status = 'minimized' }),
      restoreNode: (id) => set((s) => { const n = s.nodes.find(n => n.id === id); if (n) n.data.status = 'idle' }),
      deleteNode: (id) => set((s) => {
        s.nodes = s.nodes.filter(n => n.id !== id)
        s.edges = s.edges.filter(e => e.source !== id && e.target !== id)
        if (s.activeNodeId === id) s.activeNodeId = null
      }),
      renameNode: (id, label) => set((s) => {
        const n = s.nodes.find(n => n.id === id)
        if (n && label.trim()) { n.data.label = label.trim(); n.data.updatedAt = Date.now() }
      }),
      resolveTangent: (tangentId, targetId) => set((s) => {
        const tangent = s.nodes.find(n => n.id === tangentId)
        if (tangent) { tangent.data.resolvedTo = targetId; tangent.data.status = 'done' }
        const openEdge = s.edges.find(e => e.target === tangentId)
        if (openEdge) openEdge.data = { kind: 'tangent-resolved' as EdgeKind }
        s.edges.push({ id: nanoid(6), source: tangentId, target: targetId, type: 'tiebackEdge', data: { kind: 'tieback' as EdgeKind } })
      }),

      setDefinitionOfDone: (nodeId, dod) => set((s) => {
        const n = s.nodes.find(n => n.id === nodeId)
        if (n) n.data.definitionOfDone = dod
      }),

      addChatMessage: (nodeId, msg) => set((s) => {
        const n = s.nodes.find(n => n.id === nodeId)
        if (n) { n.data.chatHistory.push(msg); n.data.updatedAt = Date.now() }
      }),

      updateHandoffDoc: (nodeId, doc) => set((s) => {
        const n = s.nodes.find(n => n.id === nodeId)
        if (!n) return
        const existing = n.data.handoffDoc
        if (existing) {
          existing.versions.push({ timestamp: Date.now(), snapshot: { ...existing, versions: [] } })
          Object.assign(existing, doc)
        } else {
          n.data.handoffDoc = { ...doc, versions: [] }
        }
        n.data.updatedAt = Date.now()
      }),

      addEnvVar: (nodeId, key) => set((s) => {
        const n = s.nodes.find(n => n.id === nodeId)
        if (n) { if (!n.data.envVars) n.data.envVars = []; n.data.envVars.push({ key, value: '', isSet: false }) }
      }),

      updateEnvVar: (nodeId, key, value) => set((s) => {
        const n = s.nodes.find(n => n.id === nodeId)
        if (n?.data.envVars) {
          const v = n.data.envVars.find(e => e.key === key)
          if (v) { v.value = value; v.isSet = value.trim().length > 0 }
        }
      }),

      // ─── Blueprint ─────────────────────────────────────────────────────────

      generateBlueprint: async (idea: string) => {
        const state = get()
        set((s) => { s.blueprintLoading = true; s.blueprintError = null })

        const prompt = `You are a senior software architect. Break this project idea into logical build sections.

Project idea: "${idea}"

Return ONLY a JSON array (no markdown, no explanation):
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
- Always include a "Project Setup" section first
- Be specific and actionable`

        try {
          const text = await runClaude(prompt, { apiKey: state.apiKey, maxTokens: 1200 })
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
          set((s) => { if (s.project) s.project.blueprint = sections })
        }
        sections.forEach((section, i) => {
          store.addSectionNode(section.label, { x: 600 + i * 520, y: 300 })
        })
      },

      // ─── Context injection ────────────────────────────────────────────────

      buildProjectContext: (nodeId?: string): ProjectContext => {
        const state = get()
        const project = state.project
        const nodes = state.nodes
        const sectionNodes = nodes.filter(n => n.data.kind === 'section' || n.data.kind === 'overview')
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
          adrs: (project?.adrs || []).map(a => ({ title: a.title, decision: a.decision, reason: a.reason })),
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
# Auto-generated — paste at the start of your Claude Code session

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
${ctx.sections.map(s => `- [${s.status === 'done' ? 'x' : s.status === 'blocked' ? '!' : ' '}] ${s.label}${s.description ? ': ' + s.description : ''}`).join('\n')}

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

      // ─── Handoff doc ───────────────────────────────────────────────────────

      generateHandoffDoc: async (nodeId: string) => {
        const state = get()
        const node = state.nodes.find(n => n.id === nodeId)
        if (!node) return

        const history = node.data.chatHistory
        if (history.length === 0) return

        const prompt = `You are a technical writer. Based on this coding session chat history for section "${node.data.label}", generate a concise handoff document.

Chat history:
${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

Return a JSON object:
{
  "whatWasBuilt": "...",
  "decisionsMAde": "...",
  "currentStatus": "...",
  "nextSteps": "...",
  "filesChanged": ["file1.ts", "file2.ts"]
}`

        try {
          const text = await runClaude(prompt, { apiKey: state.apiKey, maxTokens: 600 })
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
          setTimeout(() => get().generateContextFile(nodeId), 200)

          const alreadyHasHandoff = state.nodes.some(n => n.data.kind === 'handoff' && n.data.parentId === nodeId)
          if (!alreadyHasHandoff) {
            const parent = state.nodes.find(n => n.id === nodeId)!
            const handoffNode = makeNode('handoff', `${node.data.label} — Handoff`, {
              x: parent.position.x,
              y: parent.position.y + 360,
            }, { parentId: nodeId, handoffDoc: doc })

            set((s) => {
              s.nodes.push(handoffNode)
              s.edges.push({ id: nanoid(6), source: nodeId, target: handoffNode.id, type: 'tangentEdge', data: { kind: 'tangent-resolved' as EdgeKind } })
            })
          }
        } catch (err) {
          console.error('Handoff doc generation failed:', err)
        }
      },

      // ─── Final handoff export ─────────────────────────────────────────────

      exportFinalHandoff: (): string => {
        const state = get()
        const project = state.project
        const nodes = state.nodes
        const sectionNodes = nodes.filter(n => n.data.kind === 'section')
        const bugNodes     = nodes.filter(n => n.data.kind === 'bug')
        const tangentNodes = nodes.filter(n => n.data.kind === 'tangent')
        const deployNodes  = nodes.filter(n => n.data.kind === 'deploy')
        const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

        let md = `# ${project?.name ?? 'Project'} — Final Handoff Document\nGenerated: ${now}\n\n---\n\n`
        md += `## Project Overview\n- **Stack:** ${project?.stack ?? 'Unknown'}\n- **Deploy Target:** ${project?.deployTarget ?? 'Unknown'}\n- **Description:** ${project?.description ?? ''}\n\n`

        if (project?.adrs && project.adrs.length > 0) {
          md += `## Architecture Decisions\n`
          project.adrs.forEach(adr => { md += `### ${adr.title}\n- **Decision:** ${adr.decision}\n- **Reason:** ${adr.reason}\n\n` })
        }

        md += `## Sections\n\n`
        sectionNodes.forEach(n => {
          const status = n.data.status === 'done' ? '[x]' : n.data.status === 'blocked' ? '[!]' : '[ ]'
          md += `### ${status} ${n.data.label}\n`
          if (n.data.handoffDoc) {
            const doc = n.data.handoffDoc
            md += `**What was built:** ${doc.whatWasBuilt}\n\n**Decisions made:** ${doc.decisionsMAde}\n\n**Current status:** ${doc.currentStatus}\n\n`
            if (doc.nextSteps) md += `**Next steps:** ${doc.nextSteps}\n\n`
            if (doc.filesChanged?.length > 0) { md += `**Files changed:**\n`; doc.filesChanged.forEach(f => { md += `- \`${f}\`\n` }); md += '\n' }
          } else {
            md += `_No handoff doc generated for this section._\n\n`
          }
          const myTangents = tangentNodes.filter(t => t.data.parentId === n.id)
          if (myTangents.length > 0) {
            md += `**Tangents:**\n`
            myTangents.forEach(t => { md += `- ${t.data.label} — ${t.data.resolvedTo ? 'Resolved' : 'Open'}\n` })
            md += '\n'
          }
          md += `---\n\n`
        })

        if (bugNodes.length > 0) {
          md += `## Bugs\n\n`
          bugNodes.forEach(n => {
            md += `### ${n.data.status === 'done' ? '[Fixed]' : '[Open]'} ${n.data.label}\n`
            if (n.data.bugDescription) md += `${n.data.bugDescription as string}\n\n`
          })
        }

        if (deployNodes.length > 0) {
          md += `## Deploy\n\n`
          deployNodes.forEach(n => {
            md += `- **Target:** ${n.data.deployTarget ?? 'Unknown'}\n- **Status:** ${n.data.deployStatus ?? 'idle'}\n`
            if (n.data.deployUrl) md += `- **URL:** ${n.data.deployUrl as string}\n`
            md += '\n'
          })
        }

        if (project?.completionChecklist && project.completionChecklist.length > 0) {
          md += `## Completion Checklist\n\n`
          project.completionChecklist.forEach(item => { md += `- [${item.done ? 'x' : ' '}] ${item.label}\n` })
          md += '\n'
        }

        return md
      },
    })),
    {
      name: 'workstation-store',
      partialize: (s) => ({
        projects: s.projects,
        activeProjectId: s.activeProjectId,
        project: s.project,
        nodes: s.nodes,
        edges: s.edges,
        apiKey: s.apiKey,
        claudeCliPath: s.claudeCliPath,
      }),
    }
  )
)
