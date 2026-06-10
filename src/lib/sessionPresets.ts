import { SessionPresetKind } from '@/types'

export interface SessionPreset {
  kind: SessionPresetKind
  label: string
  description: string
  /** Short prompt typed into Claude Code on boot */
  bootPrompt: (ctx: {
    projectName: string
    sectionLabel: string
    sectionGoal: string
    stack: string
    handoffSummary?: string
    projectDir: string
  }) => string
}

// ─── Preset definitions ───────────────────────────────────────────────────────

export const SESSION_PRESETS: Record<SessionPresetKind, SessionPreset> = {

  setup: {
    kind: 'setup',
    label: 'Project Setup',
    description: 'Scaffold the project, configure tooling, set up environment',
    bootPrompt: ({ projectName, stack, projectDir }) =>
      `You are helping set up a new project called "${projectName}" using ${stack}. ` +
      `Your working directory is ${projectDir}. ` +
      `Your job: scaffold the project structure, install dependencies, configure linting/formatting/testing, ` +
      `and make sure the dev server runs. Do not build any features yet. ` +
      `Start by listing what you plan to do, then ask if I want to proceed.`,
  },

  feature: {
    kind: 'feature',
    label: 'Feature',
    description: 'Build a new feature or complete a section of the project',
    bootPrompt: ({ projectName, sectionLabel, sectionGoal, stack, handoffSummary, projectDir }) =>
      `You are a senior ${stack} developer working on "${projectName}". ` +
      `Working directory: ${projectDir}. ` +
      `Current task: "${sectionLabel}" — ${sectionGoal}. ` +
      (handoffSummary ? `Last session: ${handoffSummary}. ` : 'This is the first session on this task. ') +
      `Rules: write production-quality code, use TDD where possible (write failing test first), ` +
      `create vertical slices not horizontal layers, ask before making large structural changes. ` +
      `Start by exploring the relevant files and telling me your implementation plan.`,
  },

  bug: {
    kind: 'bug',
    label: 'Bug Fix',
    description: 'Investigate and fix a specific bug',
    bootPrompt: ({ projectName, sectionLabel, sectionGoal, stack, projectDir }) =>
      `You are debugging a ${stack} project called "${projectName}". ` +
      `Working directory: ${projectDir}. ` +
      `Bug report: "${sectionLabel}" — ${sectionGoal}. ` +
      `Start by reproducing the issue. Show me the relevant code before changing anything. ` +
      `Explain your hypothesis before writing a fix. Add a regression test once fixed.`,
  },

  refactor: {
    kind: 'refactor',
    label: 'Refactor',
    description: 'Improve code structure without changing behaviour',
    bootPrompt: ({ projectName, sectionLabel, sectionGoal, stack, projectDir }) =>
      `You are refactoring part of "${projectName}" (${stack}). ` +
      `Working directory: ${projectDir}. ` +
      `Target: "${sectionLabel}" — ${sectionGoal}. ` +
      `Rules: do NOT change external behaviour. Run tests before and after each change. ` +
      `Prefer deep modules over shallow ones. Reduce surface area, increase cohesion. ` +
      `Show me the before/after diff and explain each change.`,
  },

  review: {
    kind: 'review',
    label: 'Code Review',
    description: 'Review code quality, tests, and coverage in a fresh context',
    bootPrompt: ({ projectName, sectionLabel, stack, projectDir }) =>
      `You are doing a code review for "${projectName}" (${stack}). ` +
      `Working directory: ${projectDir}. ` +
      `Review target: "${sectionLabel}". ` +
      `Check for: correctness, test coverage, edge cases, security issues, ` +
      `overly shallow modules, missing error handling, and type safety. ` +
      `List issues by severity (critical / major / minor). ` +
      `Do not fix anything yet — just report what you find.`,
  },
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Infer the most likely preset kind from a section label.
 * Falls back to 'feature'.
 */
export function inferPresetKind(label: string): SessionPresetKind {
  const l = label.toLowerCase()
  if (l.includes('setup') || l.includes('scaffold') || l.includes('init')) return 'setup'
  if (l.includes('bug') || l.includes('fix') || l.includes('issue'))       return 'bug'
  if (l.includes('refactor') || l.includes('cleanup') || l.includes('tidy')) return 'refactor'
  if (l.includes('review') || l.includes('audit') || l.includes('check'))  return 'review'
  return 'feature'
}
