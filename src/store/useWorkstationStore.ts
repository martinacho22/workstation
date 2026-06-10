import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import {
  Node, Edge, NodeChange, EdgeChange,
  applyNodeChanges, applyEdgeChanges,
} from '@xyflow/react'
import {
  WorkstationNodeData, Project, ProjectMeta, ChatMessage,
  HandoffDoc, BlueprintSection, BlockedReason,
  ProjectContext, ArchitectureDecisionRecord,
  Bug, SessionDecision, GrillAnswer,
} from '@/types'
import { nanoid } from 'nanoid'
import { runClaude } from '@/lib/claudeRunner'
import { CanvasCommand } from '@/lib/intentParser'
import { runCriticPass, runLayoutPass } from '@/lib/layoutEngine'

// ─── State Shape ──────────────────────────────────────────────────────────────

interface WorkstationState {
  // Multi-project registry
  projects:         Project[]
  activeProjectId:  string | null
  createProject:    (p: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>
  switchProject:    (id: string) => void
  deleteProject:    (id: string) => void
  getProjectMetas:  () => ProjectMeta[]

  // Active project
  project:       Project | null
  setProject:    (p: Project) => void
  updateProject: (patch: Partial<Project>) => void

  // Grill Me
  grillLoading:  boolean
  grillQuestion: string | null
  grillAnswers:  GrillAnswer[]
  startGrill:    (idea: string) => Promise<void>
  answerGrill:   (answer: string) => Promise<void>
  finishGrill:   () => void

  // Blueprint — now a 3-pass pipeline
  blueprintLoading:   boolean
  blueprintPhase:     'idle' | 'generating' | 'critiquing' | 'laying-out' | 'done'
  blueprintCritique:  string | null
  blueprintError:     string | null
  generateBlueprint:  () => Promise<void>
  applyBlueprint:     (sections: BlueprintSection[], positions?: { label: string; x: number; y: number }[]) => void

  // Canvas
  nodes:             Node<WorkstationNodeData>[]
  edges:             Edge[]
  onNodesChange:     (changes: NodeChange[]) => void
  onEdgesChange:     (changes: EdgeChange[]) => void
  addSectionNode:    (label: string, position?: { x: number; y: number }, description?: string) => string
  addFlowEdge:       (source: string, target: string) => void
  updateNodeStatus:  (id: string, status: WorkstationNodeData['status'], blockedReason?: BlockedReason) => void
  deleteNode:        (id: string) => void
  renameNode:        (id: string, label: string) => void
  executeCommands:   (commands: CanvasCommand[]) => void

  // Session
  activeNodeId:    string | null
  setActiveNode:   (id: string | null) => void
  addChatMessage:  (nodeId: string, msg: ChatMessage) => void
  endSession:      (nodeId: string) => Promise<void>
  sessionLoading:  boolean

  // Context
  buildProjectContext:  (nodeId?: string) => ProjectContext
  generateContextBlock: (nodeId: string) => string

  // Handoff
  generateHandoffDoc: (nodeId: string) => Promise<void>
  updateHandoffDoc:   (nodeId: string, doc: HandoffDoc) => void

  // Bugs
  addBug:    (description: string, affectedSection: string) => void
  fixBug:    (id: string) => void
  deleteBug: (id: string) => void

  // Decisions
  addDecision:    (decision: string, reason: string, sectionId: string) => void
  deleteDecision: (id: string) => void

  // ADRs
  addAdr:    (title: string, decision: string, reason: string) => void
  deleteAdr: (id: string) => void

  // Export
  exportHandoff: () => string

  // Claude CLI
  claudeCliPath:    string
  setClaudeCliPath: (p: string) => void
}

// ─── Node Factory ─────────────────────────────────────────────────────────────

function makeNode(
  kind:     WorkstationNodeData['kind'],
  label:    string,
  position: { x: number; y: number },
  extra:    Partial<WorkstationNodeData> = {}
): Node<WorkstationNodeData> {
  const id = nanoid(8)
  return {
    id,
    type: kind === 'overview' ? 'overviewNode' : 'sectionNode',
    position,
    data: {
      id, kind, label,
      status:      'idle',
      chatHistory: [],
      createdAt:   Date.now(),
      updatedAt:   Date.now(),
      ...extra,
    },
  }
}

const INITIAL_NODES: Node<WorkstationNodeData>[] = [
  makeNode('overview', 'Overview', { x: 80, y: 300 }),
]

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWorkstationStore = create<WorkstationState>()(
  persist(
    immer((set, get) => ({

      // ── Multi-project ──────────────────────────────────────────────────────

      projects:        [],
      activeProjectId: null,

      createProject: async (p) => {
        const id  = nanoid(10)
        const now = Date.now()

        let projectDir: string | undefined
        try {
          const electronAPI = (window as any).electron
          if (electronAPI?.fs?.createProjectDir) {
            const result = await electronAPI.fs.createProjectDir(p.name)
            if (result?.success) projectDir = result.projectDir
          }
        } catch (_) {}

        const newProject: Project = {
          ...p, id, createdAt: now, updatedAt: now,
          ...(projectDir ? { projectDir } : {}),
        }

        set((s) => {
          s.projects.push(newProject)
          s.activeProjectId = id
          s.project = newProject
          s.nodes = [makeNode('overview', 'Overview', { x: 80, y: 300 })]
          s.edges = []
          s.activeNodeId = null
          s.grillAnswers = []
          s.grillQuestion = null
        })
        return id
      },

      switchProject: (id) => {
        const state = get()
        if (state.activeProjectId) {
          set((s) => {
            const current = s.projects.find(p => p.id === s.activeProjectId)
            if (current) {
              current.nodes    = s.nodes as unknown[]
              current.edges    = s.edges as unknown[]
              current.updatedAt = Date.now()
            }
          })
        }
        set((s) => {
          const target = s.projects.find(p => p.id === id)
          if (target) {
            s.activeProjectId = id
            s.project = target
            s.nodes = (target.nodes as Node<WorkstationNodeData>[]) ??
              [makeNode('overview', 'Overview', { x: 80, y: 300 })]
            s.edges = (target.edges as Edge[]) ?? []
            s.activeNodeId = null
            s.grillAnswers = target.grillAnswers ?? []
            s.grillQuestion = null
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
            s.grillAnswers = []
            s.grillQuestion = null
          }
        })
      },

      getProjectMetas: () => {
        const { projects, nodes, activeProjectId } = get()
        return projects.map((p) => {
          const pNodes   = p.id === activeProjectId
            ? nodes
            : (p.nodes as Node<WorkstationNodeData>[]) ?? []
          const sections = pNodes.filter(n => n.data?.kind === 'section')
          const done     = sections.filter(n => n.data?.status === 'done').length
          const blocked  = sections.filter(n => n.data?.status === 'blocked').length
          const total    = sections.length
          const openBugs = (p.bugs ?? []).filter(b => b.status === 'open').length

          let status: ProjectMeta['status'] = 'idle'
          if (blocked > 0)                                              status = 'blocked'
          else if (done === total && total > 0)                         status = 'done'
          else if (sections.some(n => n.data?.status === 'active'))     status = 'active'
          else if (total > 0)                                           status = 'active'

          return {
            id:            p.id,
            name:          p.name,
            description:   p.description,
            stack:         p.stack,
            repoPath:      p.repoPath,
            projectDir:    p.projectDir,
            progress:      total > 0 ? Math.round((done / total) * 100) : 0,
            sectionsTotal: total,
            sectionsDone:  done,
            openBugs,
            lastActive:    p.updatedAt,
            status,
          } satisfies ProjectMeta
        })
      },

      project: null,
      setProject: (p) => set((s) => {
        s.project = p
        const idx = s.projects.findIndex(x => x.id === p.id)
        if (idx >= 0) s.projects[idx] = p
        else s.projects.push(p)
        s.activeProjectId = p.id
      }),

      updateProject: (patch) => set((s) => {
        if (!s.project) return
        Object.assign(s.project, patch, { updatedAt: Date.now() })
        const idx = s.projects.findIndex(p => p.id === s.project?.id)
        if (idx >= 0) s.projects[idx] = s.project!
      }),

      // ── Grill Me ──────────────────────────────────────────────────────────

      grillLoading:  false,
      grillQuestion: null,
      grillAnswers:  [],

      startGrill: async (idea: string) => {
        set((s) => { s.grillLoading = true; s.grillAnswers = [] })
        const prompt = `You are a senior software architect interviewing a developer about their project idea.

Project idea: "${idea}"

Ask ONE focused question about the most important unclear aspect of this project.
The question should uncover assumptions, constraints, or decisions that will shape the architecture.
Give your recommended answer in brackets after the question.

Format exactly:
QUESTION: [your question here]
RECOMMENDATION: [your recommended answer]`

        try {
          const text  = await runClaude(prompt)
          const qMatch = text.match(/QUESTION:\s*(.+)/i)
          const rMatch = text.match(/RECOMMENDATION:\s*(.+)/i)
          if (qMatch) {
            set((s) => {
              s.grillQuestion = qMatch[1].trim() +
                (rMatch ? `\n\nRecommendation: ${rMatch[1].trim()}` : '')
              s.grillLoading = false
            })
          }
        } catch {
          set((s) => { s.grillLoading = false })
        }
      },

      answerGrill: async (answer: string) => {
        const state          = get()
        const currentQuestion = state.grillQuestion?.split('\n\nRecommendation:')[0] ?? ''
        const newAnswers      = [...state.grillAnswers, { question: currentQuestion, answer }]

        set((s) => { s.grillAnswers = newAnswers; s.grillLoading = true; s.grillQuestion = null })

        if (newAnswers.length >= 6) {
          set((s) => { s.grillLoading = false })
          get().finishGrill()
          await get().generateBlueprint()
          return
        }

        const historyText = newAnswers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')
        const prompt = `You are a senior software architect interviewing a developer.

Previous Q&A:
${historyText}

Ask ONE more focused question about the most important remaining unknown.
Don't repeat topics already covered.
Give your recommended answer.

Format exactly:
QUESTION: [your question here]
RECOMMENDATION: [your recommended answer]`

        try {
          const text  = await runClaude(prompt)
          const qMatch = text.match(/QUESTION:\s*(.+)/i)
          const rMatch = text.match(/RECOMMENDATION:\s*(.+)/i)
          if (qMatch) {
            set((s) => {
              s.grillQuestion = qMatch[1].trim() +
                (rMatch ? `\n\nRecommendation: ${rMatch[1].trim()}` : '')
              s.grillLoading = false
            })
          }
        } catch {
          set((s) => { s.grillLoading = false })
        }
      },

      finishGrill: () => {
        const state = get()
        set((s) => {
          if (s.project) {
            s.project.grillAnswers = state.grillAnswers
            const idx = s.projects.findIndex(p => p.id === s.project?.id)
            if (idx >= 0) s.projects[idx] = s.project!
          }
          s.grillQuestion = null
        })
      },

      // ── Blueprint — 3-pass pipeline ────────────────────────────────────────
      //
      //  Pass 1: Generate initial sections from grill answers
      //  Pass 2: Critic reviews for stress points, returns amended sections
      //  Pass 3: Layout engine assigns (x, y) positions as a smart DAG
      //
      blueprintLoading:  false,
      blueprintPhase:    'idle',
      blueprintCritique: null,
      blueprintError:    null,

      generateBlueprint: async () => {
        const state = get()
        if (!state.project) return

        set((s) => {
          s.blueprintLoading = true
          s.blueprintPhase   = 'generating'
          s.blueprintError   = null
          s.blueprintCritique = null
        })

        const grillContext = state.grillAnswers.length > 0
          ? `\n\nRequirements clarified through Q&A:\n${state.grillAnswers.map(a => `- ${a.question}: ${a.answer}`).join('\n')}`
          : ''

        // ── Pass 1: Generate ──────────────────────────────────────────────
        let rawSections: BlueprintSection[]
        try {
          const prompt = `You are a senior software architect. Break this project into logical build sections.

Project: "${state.project.name}"
Description: "${state.project.description}"
Stack: "${state.project.stack}"${grillContext}

Return ONLY a JSON array (no markdown, no explanation):
[
  {
    "label": "Section Name",
    "description": "What this section builds and why",
    "dependsOn": ["Other Section Label or empty array"]
  }
]

Rules:
- 4-8 sections
- First section is always "Project Setup"
- Each section is a vertical slice — something testable end-to-end
- Ordered so dependencies come before dependants
- Be specific to the stack: ${state.project.stack}`

          const text  = await runClaude(prompt)
          const match = text.match(/\[[\s\S]*\]/)
          if (!match) throw new Error('No JSON array in response')
          rawSections = JSON.parse(match[0])
        } catch (err) {
          set((s) => {
            s.blueprintLoading = false
            s.blueprintPhase   = 'idle'
            s.blueprintError   = err instanceof Error ? err.message : 'Blueprint failed'
          })
          return
        }

        // ── Pass 2: Critic ────────────────────────────────────────────────
        set((s) => { s.blueprintPhase = 'critiquing' })
        const { sections: reviewedSections, critique } = await runCriticPass(
          rawSections,
          state.project.name,
          state.project.stack,
        )
        set((s) => { s.blueprintCritique = critique })

        // ── Pass 3: Layout ────────────────────────────────────────────────
        set((s) => { s.blueprintPhase = 'laying-out' })
        const positions = await runLayoutPass(reviewedSections)

        // ── Apply ─────────────────────────────────────────────────────────
        get().applyBlueprint(reviewedSections, positions)
        set((s) => {
          s.blueprintLoading = false
          s.blueprintPhase   = 'done'
        })
      },

      applyBlueprint: (sections, positions) => {
        const store = get()

        // Save blueprint to project
        set((s) => {
          if (s.project) s.project.blueprint = sections
          // Clear existing section nodes
          s.nodes = s.nodes.filter(n => n.data.kind === 'overview')
          s.edges = []
        })

        // Build a position map from layout pass
        const posMap = new Map<string, { x: number; y: number }>()
        if (positions) {
          for (const p of positions) posMap.set(p.label, { x: p.x, y: p.y })
        }

        // Fallback sequential positions
        sections.forEach((section, i) => {
          const pos = posMap.get(section.label) ?? { x: 600 + i * 360, y: 300 }
          store.addSectionNode(section.label, pos, section.description)
        })

        // Wire dependency edges
        const state = get()
        sections.forEach((section) => {
          if (section.dependsOn?.length > 0) {
            section.dependsOn.forEach((depLabel) => {
              const fromNode = state.nodes.find(n => n.data.label === depLabel)
              const toNode   = state.nodes.find(n => n.data.label === section.label)
              if (fromNode && toNode) {
                const alreadyExists = state.edges.some(
                  e => e.source === fromNode.id && e.target === toNode.id
                )
                if (!alreadyExists) {
                  set((s) => {
                    s.edges.push({
                      id:     `edge-${nanoid(6)}`,
                      source: fromNode.id,
                      target: toNode.id,
                      type:   'dependencyEdge',
                      data:   { kind: 'dependency' },
                    })
                  })
                }
              }
            })
          }
        })
      },

      // ── Canvas ────────────────────────────────────────────────────────────

      nodes: INITIAL_NODES,
      edges: [],

      onNodesChange: (changes) =>
        set((s) => { s.nodes = applyNodeChanges(changes, s.nodes) as Node<WorkstationNodeData>[] }),

      onEdgesChange: (changes) =>
        set((s) => { s.edges = applyEdgeChanges(changes, s.edges) }),

      addSectionNode: (label, position, description) => {
        const { nodes } = get()
        const mainNodes  = nodes.filter(n => n.data.kind === 'section' || n.data.kind === 'overview')
        const rightmost  = mainNodes.reduce((max, n) => Math.max(max, n.position.x), 0)
        const pos        = position ?? { x: rightmost + 360, y: 300 }
        const node       = makeNode('section', label, pos,
          description ? { description } as Partial<WorkstationNodeData> : {})

        set((s) => { s.nodes.push(node) })
        return node.id
      },

      addFlowEdge: (source: string, target: string) => {
        set((s) => {
          const alreadyExists = s.edges.some(e => e.source === source && e.target === target)
          if (alreadyExists) return

          s.edges.push({
            id:     `edge-${nanoid(6)}`,
            source,
            target,
            type:   'flowEdge',
            data:   { kind: 'flow' },
          })
        })
      },

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

      deleteNode: (id) => set((s) => {
        s.nodes = s.nodes.filter(n => n.id !== id)
        s.edges = s.edges.filter(e => e.source !== id && e.target !== id)
        if (s.activeNodeId === id) s.activeNodeId = null
      }),

      renameNode: (id, label) => set((s) => {
        const n = s.nodes.find(n => n.id === id)
        if (n && label.trim()) { n.data.label = label.trim(); n.data.updatedAt = Date.now() }
      }),

      // ── Execute Canvas Commands (from intent parser) ───────────────────────

      executeCommands: (commands: CanvasCommand[]) => {
        const store = get()
        for (const cmd of commands) {
          switch (cmd.type) {
            case 'BLUEPRINT': {
              const sections: BlueprintSection[] = cmd.nodes.map(n => ({
                label:       n.label,
                description: n.description,
                dependsOn:   n.depends ? [n.depends] : [],
              }))
              set((s) => {
                if (s.project) s.project.blueprint = sections
              })
              store.applyBlueprint(sections)
              break
            }
            case 'SPAWN_NODE': {
              const exists = store.nodes.some(n => n.data.label === cmd.label)
              if (!exists) {
                store.addSectionNode(cmd.label, undefined, cmd.description)
                set((s) => {
                  if (s.project) {
                    if (!s.project.blueprint) s.project.blueprint = []
                    s.project.blueprint.push({
                      label:       cmd.label,
                      description: cmd.description ?? '',
                      dependsOn:   cmd.depends ? [cmd.depends] : [],
                    })
                  }
                })
              }
              break
            }
            case 'UPDATE_STATUS': {
              const node = store.nodes.find(n => n.data.label === cmd.label)
              if (node) store.updateNodeStatus(node.id, cmd.status)
              break
            }
            case 'ADD_EDGE': {
              const fromNode = store.nodes.find(n => n.data.label === cmd.from)
              const toNode   = store.nodes.find(n => n.data.label === cmd.to)
              if (fromNode && toNode) {
                store.addFlowEdge(fromNode.id, toNode.id)
              }
              break
            }
            case 'SET_PHASE':
              set((s) => { if (s.project) (s.project as any).currentPhase = cmd.phase })
              break
          }
        }
      },

      // ── Session ───────────────────────────────────────────────────────────

      activeNodeId:   null,
      sessionLoading: false,

      setActiveNode: (id) => set((s) => { s.activeNodeId = id }),

      addChatMessage: (nodeId, msg) => set((s) => {
        const n = s.nodes.find(n => n.id === nodeId)
        if (n) {
          n.data.chatHistory.push(msg)
          n.data.updatedAt = Date.now()
          if (n.data.status === 'idle') n.data.status = 'active'
        }
      }),

      endSession: async (nodeId: string) => {
        set((s) => { s.sessionLoading = true })
        await get().generateHandoffDoc(nodeId)
        const ctx = get().generateContextBlock(nodeId)
        set((s) => {
          const n = s.nodes.find(n => n.id === nodeId)
          if (n) n.data.contextSnapshot = ctx
          s.sessionLoading = false
          s.activeNodeId   = null
        })
      },

      // ── Context ───────────────────────────────────────────────────────────

      buildProjectContext: (nodeId?: string): ProjectContext => {
        const { project, nodes } = get()
        const currentNode  = nodeId ? nodes.find(n => n.id === nodeId) : undefined
        const sectionNodes = nodes.filter(n => n.data.kind === 'section' || n.data.kind === 'overview')

        return {
          projectName:          project?.name ?? 'Untitled',
          projectDescription:   project?.description ?? '',
          stack:                project?.stack ?? '',
          repoPath:             project?.repoPath,
          projectDir:           project?.projectDir,
          sections: sectionNodes.map(n => ({
            label:       n.data.label,
            status:      n.data.status,
            description: project?.blueprint?.find(b => b.label === n.data.label)?.description,
          })),
          adrs:  (project?.adrs ?? []).map(a => ({ title: a.title, decision: a.decision, reason: a.reason })),
          bugs:  (project?.bugs ?? []).filter(b => b.status === 'open').map(b => ({
            description: b.description, affectedSection: b.affectedSection, status: b.status,
          })),
          currentSection:        currentNode?.data.label,
          currentSectionPurpose: project?.blueprint?.find(b => b.label === currentNode?.data.label)?.description,
          handoffSummary:        currentNode?.data.handoffDoc
            ? `Last session: ${currentNode.data.handoffDoc.currentStatus}. Next: ${currentNode.data.handoffDoc.nextSteps}`
            : undefined,
        }
      },

      generateContextBlock: (nodeId: string): string => {
        const ctx       = get().buildProjectContext(nodeId)
        const doneCount = ctx.sections.filter(s => s.status === 'done').length
        const total     = ctx.sections.length
        const cwd       = ctx.projectDir ?? ctx.repoPath ?? '(not set)'

        return `# Workstation Context
# Project: ${ctx.projectName} | Stack: ${ctx.stack} | Progress: ${doneCount}/${total} sections done
# Working directory: ${cwd}

## Working on: ${ctx.currentSection ?? 'Overview'}
${ctx.currentSectionPurpose ? `Goal: ${ctx.currentSectionPurpose}` : ''}
${ctx.handoffSummary ?? 'First session in this section.'}

## All Sections
${ctx.sections.map(s => `[${s.status === 'done' ? 'x' : s.status === 'blocked' ? '!' : ' '}] ${s.label}${s.description ? ' — ' + s.description : ''}`).join('\n')}

## Architecture Decisions
${ctx.adrs.length > 0 ? ctx.adrs.map(a => `- ${a.title}: ${a.decision} (${a.reason})`).join('\n') : 'None recorded.'}

## Open Bugs
${ctx.bugs.length > 0 ? ctx.bugs.map(b => `- [${b.affectedSection}] ${b.description}`).join('\n') : 'None.'}

## Instructions
You are working on "${ctx.currentSection ?? 'this project'}" in ${ctx.projectName}.
Stack: ${ctx.stack}. Working directory: ${cwd}.
${ctx.currentSectionPurpose ? `Your goal: ${ctx.currentSectionPurpose}` : ''}
Write production-quality code. Ask before large structural changes. Be concise.`
      },

      // ── Handoff Docs ──────────────────────────────────────────────────────

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

      generateHandoffDoc: async (nodeId: string) => {
        const { nodes } = get()
        const node = nodes.find(n => n.id === nodeId)
        if (!node || node.data.chatHistory.length === 0) return

        const recentHistory = node.data.chatHistory.slice(-20)
        const prompt = `You are a technical writer. Based on this coding session for "${node.data.label}", write a concise handoff document.

Session transcript:
${recentHistory.map(m => `${m.role === 'user' ? 'Developer' : 'Claude'}: ${m.content.slice(0, 500)}`).join('\n')}

Return ONLY a JSON object:
{
  "whatWasBuilt":  "1-2 sentences on what was implemented",
  "decisionsMade": "key technical decisions made",
  "currentStatus": "where things stand right now",
  "nextSteps":     "specific next actions",
  "filesChanged":  ["list", "of", "files"]
}`

        try {
          const text  = await runClaude(prompt)
          const match = text.match(/\{[\s\S]*\}/)
          if (!match) return
          const parsed = JSON.parse(match[0])
          get().updateHandoffDoc(nodeId, {
            nodeId,
            nodeLabel:     node.data.label,
            lastUpdated:   Date.now(),
            whatWasBuilt:  parsed.whatWasBuilt  ?? '',
            decisionsMade: parsed.decisionsMade ?? '',
            currentStatus: parsed.currentStatus ?? '',
            nextSteps:     parsed.nextSteps     ?? '',
            filesChanged:  parsed.filesChanged  ?? [],
            versions:      [],
          })
        } catch (err) {
          console.error('Handoff generation failed:', err)
        }
      },

      // ── Bugs ──────────────────────────────────────────────────────────────

      addBug: (description, affectedSection) => set((s) => {
        if (!s.project) return
        if (!s.project.bugs) s.project.bugs = []
        s.project.bugs.push({
          id: nanoid(6), description, affectedSection, status: 'open', createdAt: Date.now(),
        })
        s.project.updatedAt = Date.now()
        const idx = s.projects.findIndex(p => p.id === s.project?.id)
        if (idx >= 0) s.projects[idx] = s.project!
      }),

      fixBug: (id) => set((s) => {
        const bug = s.project?.bugs?.find(b => b.id === id)
        if (bug) { bug.status = 'fixed'; bug.fixedAt = Date.now() }
        const idx = s.projects.findIndex(p => p.id === s.project?.id)
        if (idx >= 0 && s.project) s.projects[idx] = s.project
      }),

      deleteBug: (id) => set((s) => {
        if (!s.project?.bugs) return
        s.project.bugs = s.project.bugs.filter(b => b.id !== id)
        const idx = s.projects.findIndex(p => p.id === s.project?.id)
        if (idx >= 0) s.projects[idx] = s.project!
      }),

      // ── Decisions ─────────────────────────────────────────────────────────

      addDecision: (decision, reason, sectionId) => set((s) => {
        if (!s.project) return
        if (!s.project.decisions) s.project.decisions = []
        s.project.decisions.push({ id: nanoid(6), decision, reason, sectionId, createdAt: Date.now() })
        s.project.updatedAt = Date.now()
        const idx = s.projects.findIndex(p => p.id === s.project?.id)
        if (idx >= 0) s.projects[idx] = s.project!
      }),

      deleteDecision: (id) => set((s) => {
        if (!s.project?.decisions) return
        s.project.decisions = s.project.decisions.filter(d => d.id !== id)
        const idx = s.projects.findIndex(p => p.id === s.project?.id)
        if (idx >= 0) s.projects[idx] = s.project!
      }),

      // ── ADRs ──────────────────────────────────────────────────────────────

      addAdr: (title, decision, reason) => set((s) => {
        if (!s.project) return
        if (!s.project.adrs) s.project.adrs = []
        s.project.adrs.push({ id: nanoid(6), title, decision, reason, createdAt: Date.now() })
        s.project.updatedAt = Date.now()
        const idx = s.projects.findIndex(p => p.id === s.project?.id)
        if (idx >= 0) s.projects[idx] = s.project!
      }),

      deleteAdr: (id) => set((s) => {
        if (!s.project?.adrs) return
        s.project.adrs = s.project.adrs.filter(a => a.id !== id)
        const idx = s.projects.findIndex(p => p.id === s.project?.id)
        if (idx >= 0) s.projects[idx] = s.project!
      }),

      // ── Export ────────────────────────────────────────────────────────────

      exportHandoff: (): string => {
        const { project, nodes } = get()
        const sections = nodes.filter(n => n.data.kind === 'section')
        const now      = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

        let md = `# ${project?.name ?? 'Project'} — Handoff\n_${now}_\n\n`
        md += `**Stack:** ${project?.stack ?? 'Unknown'}  \n`
        md += `**Description:** ${project?.description ?? ''}\n\n`
        if (project?.projectDir) md += `**Project directory:** \`${project.projectDir}\`\n\n`

        if (project?.adrs?.length) {
          md += `## Architecture Decisions\n`
          project.adrs.forEach(a => {
            md += `### ${a.title}\n- **Decision:** ${a.decision}\n- **Reason:** ${a.reason}\n\n`
          })
        }

        md += `## Sections\n\n`
        sections.forEach(n => {
          const status = n.data.status === 'done' ? '[x]' : n.data.status === 'blocked' ? '[!]' : '[ ]'
          md += `### ${status} ${n.data.label}\n`
          if (n.data.handoffDoc) {
            const d = n.data.handoffDoc
            md += `**Built:** ${d.whatWasBuilt}\n\n`
            md += `**Decisions:** ${d.decisionsMade}\n\n`
            md += `**Status:** ${d.currentStatus}\n\n`
            if (d.nextSteps)          md += `**Next:** ${d.nextSteps}\n\n`
            if (d.filesChanged?.length) md += `**Files:** ${d.filesChanged.map(f => `\`${f}\``).join(', ')}\n\n`
          }
          md += `---\n\n`
        })

        const openBugs = (project?.bugs ?? []).filter(b => b.status === 'open')
        if (openBugs.length) {
          md += `## Open Bugs\n`
          openBugs.forEach(b => { md += `- [${b.affectedSection}] ${b.description}\n` })
          md += '\n'
        }
        return md
      },

      // ── Claude CLI ────────────────────────────────────────────────────────

      claudeCliPath: 'claude',
      setClaudeCliPath: (p) => {
        set((s) => { s.claudeCliPath = p || 'claude' })
        const electronAPI = (window as any).electron
        if (electronAPI?.claude?.setPath) electronAPI.claude.setPath(p || 'claude')
      },
    })),
    {
      name: 'workstation-store-v4',
      partialize: (s) => ({
        projects:        s.projects,
        activeProjectId: s.activeProjectId,
        project:         s.project,
        nodes:           s.nodes,
        edges:           s.edges,
        claudeCliPath:   s.claudeCliPath,
        grillAnswers:    s.grillAnswers,
      }),
    }
  )
)
