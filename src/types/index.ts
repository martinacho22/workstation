// ─── Node Types ───────────────────────────────────────────────────────────────

export type NodeKind = 'section' | 'overview' | 'handoff'

export type NodeStatus = 'idle' | 'active' | 'done' | 'blocked'

export interface BlockedReason {
  reason: string
  blockedBy?: string
  since: number
}

export interface WorkstationNodeData {
  id: string
  kind: NodeKind
  label: string
  status: NodeStatus
  chatHistory: ChatMessage[]
  handoffDoc?: HandoffDoc
  parentId?: string
  blockedReason?: BlockedReason
  definitionOfDone?: string
  contextSnapshot?: string   // last auto-generated context block
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
  decisionsMade: string
  currentStatus: string
  nextSteps: string
  filesChanged: string[]
  versions: HandoffDocVersion[]
}

export interface HandoffDocVersion {
  timestamp: number
  snapshot: Omit<HandoffDoc, 'versions'>
}

// ─── Bug ──────────────────────────────────────────────────────────────────────

export interface Bug {
  id: string
  description: string
  stepsToReproduce?: string
  affectedSection: string
  status: 'open' | 'fixed'
  createdAt: number
  fixedAt?: number
}

// ─── Session Decision ─────────────────────────────────────────────────────────

export interface SessionDecision {
  id: string
  decision: string
  reason: string
  sectionId: string
  createdAt: number
}

// ─── Session preset kinds ─────────────────────────────────────────────────────

/**
 * The type of Claude Code session being opened.
 * Determines the preset system prompt sent on boot.
 */
export type SessionPresetKind =
  | 'setup'      // Project scaffolding, env, tooling
  | 'feature'    // Building a new feature / section
  | 'bug'        // Investigating and fixing a bug
  | 'refactor'   // Improving code structure without changing behaviour
  | 'review'     // Reviewing code quality, tests, coverage

// ─── Project ──────────────────────────────────────────────────────────────────

export interface GrillAnswer {
  question: string
  answer: string
}

export interface BlueprintSection {
  label: string
  description: string
  dependsOn: string[]
}

export interface Project {
  id: string
  name: string
  description: string
  stack: string
  repoPath?: string          // user-selected path (optional override)
  projectDir?: string        // auto-created ~/Workstation Projects/<name>/ — canonical CWD
  grillAnswers?: GrillAnswer[]
  blueprint?: BlueprintSection[]
  adrs?: ArchitectureDecisionRecord[]
  bugs?: Bug[]
  decisions?: SessionDecision[]
  createdAt: number
  updatedAt: number
  // Canvas snapshot for multi-project switching
  nodes?: unknown[]
  edges?: unknown[]
}

export interface ArchitectureDecisionRecord {
  id: string
  title: string
  decision: string
  reason: string
  createdAt: number
}

// ─── Canvas Edge ─────────────────────────────────────────────────────────────

export type EdgeKind = 'flow' | 'dependency'

// ─── Context File ─────────────────────────────────────────────────────────────

export interface ProjectContext {
  projectName: string
  projectDescription: string
  stack: string
  repoPath?: string
  projectDir?: string
  sections: { label: string; status: string; description?: string }[]
  adrs: { title: string; decision: string; reason: string }[]
  bugs: { description: string; affectedSection: string; status: string }[]
  currentSection?: string
  currentSectionPurpose?: string
  handoffSummary?: string
}

// ─── Project Meta (dashboard) ─────────────────────────────────────────────────

export interface ProjectMeta {
  id: string
  name: string
  description: string
  stack: string
  repoPath?: string
  projectDir?: string
  progress: number
  sectionsTotal: number
  sectionsDone: number
  openBugs: number
  lastActive: number
  status: 'active' | 'blocked' | 'done' | 'idle'
}
