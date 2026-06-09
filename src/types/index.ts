// ─── Node Types ───────────────────────────────────────────────────────────────

export type NodeKind = 'overview' | 'section' | 'tangent' | 'handoff'

export type NodeStatus = 'idle' | 'active' | 'done' | 'blocked' | 'minimized'

export interface WorkstationNodeData {
  id: string
  kind: NodeKind
  label: string
  status: NodeStatus
  terminalId?: string
  chatHistory: ChatMessage[]
  handoffDoc?: HandoffDoc
  skills: Skill[]
  skipPermissions: boolean
  parentId?: string       // for tangents — which node spawned this
  resolvedTo?: string     // for tangents — which node it tied back to
  createdAt: number
  updatedAt: number
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: number
}

// ─── Handoff Doc ──────────────────────────────────────────────────────────────

export interface HandoffDoc {
  nodeId: string
  nodeLabel: string
  lastUpdated: number
  whatWasBuilt: string
  decisionsMAde: string
  currentStatus: string
  nextSteps: string
  filesChanged: string[]
  tangentsSummary?: string
  versions: HandoffDocVersion[]
}

export interface HandoffDocVersion {
  timestamp: number
  snapshot: Omit<HandoffDoc, 'versions'>
}

// ─── Skills ───────────────────────────────────────────────────────────────────

export type SkillId =
  | 'memory'
  | 'web_search'
  | 'code_review'
  | 'architecture'
  | 'debugging'
  | 'documentation'
  | 'testing'
  | 'deployment'

export interface Skill {
  id: SkillId
  label: string
  enabled: boolean
  recommended?: boolean
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface Project {
  id: string
  name: string
  description: string
  stack: string
  accentColor: string
  createdAt: number
  updatedAt: number
}

// ─── Canvas Edge ─────────────────────────────────────────────────────────────

export type EdgeKind = 'flow' | 'tangent-open' | 'tangent-resolved' | 'tieback'
