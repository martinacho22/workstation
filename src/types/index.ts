// ─── Node Types ───────────────────────────────────────────────────────────────

export type NodeKind = 'overview' | 'section' | 'tangent' | 'handoff' | 'deploy' | 'bug'

export type NodeStatus = 'idle' | 'active' | 'done' | 'blocked' | 'minimized'

export interface BlockedReason {
  reason: string
  blockedBy?: string   // nodeId that is blocking this
  since: number
}

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
  parentId?: string        // for tangents/bugs — which node spawned this
  resolvedTo?: string      // for tangents — which node it tied back to
  blockedReason?: BlockedReason
  // Deploy node
  deployTarget?: DeployTarget
  deployStatus?: DeployStatus
  deployUrl?: string
  envVars?: EnvVar[]
  // Bug node
  bugDescription?: string
  bugStepsToReproduce?: string
  bugAffectedSection?: string
  // Context injection
  contextFile?: string     // auto-generated context injected into every terminal session
  createdAt: number
  updatedAt: number
  [key: string]: unknown
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

export interface BlueprintSection {
  label: string
  description: string
  dependsOn: string[]   // labels of sections this depends on
}

export interface Project {
  id: string
  name: string
  description: string
  stack: string
  deployTarget: DeployTarget
  accentColor: string
  blueprint?: BlueprintSection[]
  adrs?: ArchitectureDecisionRecord[]
  createdAt: number
  updatedAt: number
}

export interface ArchitectureDecisionRecord {
  id: string
  title: string
  decision: string
  reason: string
  createdAt: number
}

// ─── Canvas Edge ─────────────────────────────────────────────────────────────

export type EdgeKind = 'flow' | 'tangent-open' | 'tangent-resolved' | 'tieback'

// ─── Deploy ──────────────────────────────────────────────────────────────────

export type DeployTarget = 'vercel' | 'railway' | 'fly' | 'netlify' | 'none'

export type DeployStatus = 'idle' | 'preflight' | 'deploying' | 'live' | 'failed'

export interface EnvVar {
  key: string
  value: string
  isSet: boolean
}

// ─── Context File ─────────────────────────────────────────────────────────────

export interface ProjectContext {
  projectName: string
  projectDescription: string
  stack: string
  deployTarget: string
  sections: { label: string; status: string; description?: string }[]
  adrs: { title: string; decision: string; reason: string }[]
  currentSection?: string
  currentSectionPurpose?: string
  openTangents: { label: string; parentSection: string }[]
  handoffSummary?: string
}
