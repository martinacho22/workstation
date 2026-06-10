/**
 * layoutEngine.ts
 *
 * Two-pass post-blueprint processing:
 *
 * Pass 1 — CRITIC
 *   A fresh Claude context reviews the generated blueprint for stress points:
 *   - Missing foundational sections
 *   - Sections that are too broad (should split)
 *   - Sections that are too narrow (should merge)
 *   - Circular or missing dependencies
 *   Returns an amended sections list.
 *
 * Pass 2 — LAYOUT
 *   A fresh Claude context receives the (possibly amended) sections and their
 *   dependency graph, then returns {label, x, y} positions that organise them
 *   into a readable 2D DAG:
 *   - Parallel work (no blocking relationship) placed side-by-side vertically
 *   - Sequential work placed left-to-right horizontally
 *   - Foundations (no deps) at the left
 *   - Final integration phases at the right
 */

import { runClaude } from '@/lib/claudeRunner'
import { BlueprintSection } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LayoutPosition {
  label: string
  x:     number
  y:     number
}

export interface CriticResult {
  sections:  BlueprintSection[]
  critique:  string   // human-readable summary of what changed
}

// ─── Pass 1: Critic ───────────────────────────────────────────────────────────

export async function runCriticPass(
  sections:    BlueprintSection[],
  projectName: string,
  stack:       string,
): Promise<CriticResult> {
  const sectionList = sections
    .map(s => `- ${s.label}: ${s.description}${s.dependsOn?.length ? ` (needs: ${s.dependsOn.join(', ')})` : ''}`)
    .join('\n')

  const prompt = `You are a senior software architect reviewing a project roadmap before work starts.

Project: "${projectName}" — Stack: ${stack}

Proposed roadmap:
${sectionList}

Review this roadmap for stress points. Look for:
1. Missing foundational work (auth, DB schema, env setup) that should come first
2. Sections that are too broad — doing too many things at once
3. Sections that are too narrow — could merge with another
4. Missing dependencies — e.g. a frontend section that should depend on an API section
5. Sections that should be parallelizable but are shown as sequential

Return ONLY a JSON object:
{
  "critique": "2-3 sentence summary of the key changes made and why",
  "sections": [
    {
      "label": "Section Name",
      "description": "What this section builds",
      "dependsOn": ["label of blocking section or empty array"]
    }
  ]
}

Rules:
- Keep changes minimal — only fix genuine problems
- Do not add more than 2 new sections
- Preserve the original labels where possible
- If nothing needs changing, return the original sections unchanged with critique: "Roadmap looks solid — no changes needed."
- Return only valid JSON, no markdown`

  try {
    const text  = await runClaude(prompt)
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in critic response')
    const parsed = JSON.parse(match[0])
    return {
      sections: parsed.sections ?? sections,
      critique: parsed.critique ?? 'Review complete.',
    }
  } catch {
    // Critic failed — return original unchanged
    return { sections, critique: 'Critic pass skipped — proceeding with original roadmap.' }
  }
}

// ─── Pass 2: Layout ───────────────────────────────────────────────────────────

const NODE_W  = 240   // node width
const NODE_H  = 90    // node height
const GAP_X   = 120   // horizontal gap between columns
const GAP_Y   = 60    // vertical gap between rows
const ORIGIN_X = 80
const ORIGIN_Y = 200

export async function runLayoutPass(sections: BlueprintSection[]): Promise<LayoutPosition[]> {
  // Try Claude layout first, fall back to algorithmic if it fails
  try {
    const prompt = buildLayoutPrompt(sections)
    const text   = await runClaude(prompt)
    const match  = text.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON array')

    const parsed: { label: string; col: number; row: number }[] = JSON.parse(match[0])

    return parsed.map(p => ({
      label: p.label,
      x:     ORIGIN_X + p.col * (NODE_W + GAP_X),
      y:     ORIGIN_Y + p.row * (NODE_H + GAP_Y),
    }))
  } catch {
    // Fallback: pure algorithmic topological sort layout
    return algorithmicLayout(sections)
  }
}

function buildLayoutPrompt(sections: BlueprintSection[]): string {
  const sectionList = sections
    .map(s => `- "${s.label}" depends on: [${(s.dependsOn ?? []).map(d => `"${d}"`).join(', ')}]`)
    .join('\n')

  return `You are a diagram layout engine. Arrange these project phases on a 2D grid.

Phases and their dependencies:
${sectionList}

Grid rules:
- col = depth from left (phases with no deps = col 0, phases that depend on one col-0 phase = col 1, etc.)
- row = vertical position for PARALLEL work (independent phases at the same depth get different rows)
- Phases that cannot run in parallel because one blocks the other must be in different columns
- Phases that CAN run in parallel (no blocking relationship between them) should be at the same column, different rows
- Keep rows compact — avoid large row gaps
- Start from col 0, row 0

Return ONLY a JSON array, no markdown:
[
  { "label": "Project Setup", "col": 0, "row": 0 },
  { "label": "Auth",          "col": 1, "row": 0 },
  { "label": "API Layer",     "col": 1, "row": 1 }
]`
}

// ─── Algorithmic fallback layout (topological sort) ───────────────────────────

function algorithmicLayout(sections: BlueprintSection[]): LayoutPosition[] {
  const labels = sections.map(s => s.label)

  // Build column (depth) for each node via BFS from roots
  const depMap = new Map<string, string[]>()
  for (const s of sections) {
    depMap.set(s.label, (s.dependsOn ?? []).filter(d => labels.includes(d)))
  }

  const colMap = new Map<string, number>()

  function getCol(label: string, visited = new Set<string>()): number {
    if (colMap.has(label)) return colMap.get(label)!
    if (visited.has(label)) return 0  // cycle guard
    visited.add(label)
    const deps = depMap.get(label) ?? []
    const col  = deps.length === 0 ? 0 : Math.max(...deps.map(d => getCol(d, visited) + 1))
    colMap.set(label, col)
    return col
  }

  for (const s of sections) getCol(s.label)

  // Group by column, assign rows within each column
  const colGroups = new Map<number, string[]>()
  for (const [label, col] of colMap) {
    if (!colGroups.has(col)) colGroups.set(col, [])
    colGroups.get(col)!.push(label)
  }

  const positions: LayoutPosition[] = []
  for (const [col, group] of colGroups) {
    group.forEach((label, row) => {
      positions.push({
        label,
        x: ORIGIN_X + col * (NODE_W + GAP_X),
        y: ORIGIN_Y + row * (NODE_H + GAP_Y),
      })
    })
  }

  return positions
}
