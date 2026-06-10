/**
 * ColumnLabels — phase swim lanes on the canvas.
 *
 * Renders:
 *  - Faint background wash per column (phase lane), indexed by
 *    blueprint dependency depth
 *  - Column header label at the top of each lane
 *
 * Nodes at the same column depth share a lane. Parallel work
 * (same depth, different rows) sits in the same lane.
 */

import { useEffect, useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'

interface ColumnInfo {
  label: string   // "Foundation", "Phase 2", "Integration"
  col:   number   // depth index
  left:  number   // px offset from canvas left
  width: number   // px width of the lane
}

const LANE_COLORS = [
  'rgba(0,255,136,0.025)',
  'rgba(124,158,255,0.025)',
  'rgba(240,192,64,0.025)',
  'rgba(255,107,107,0.025)',
  'rgba(160,120,255,0.02)',
  'rgba(255,160,64,0.02)',
]

const NODE_W  = 240
const GAP_X   = 120
const ORIGIN_X = 60

export default function ColumnLabels() {
  const { project, nodes } = useWorkstationStore()
  const [columns, setColumns] = useState<ColumnInfo[]>([])

  useEffect(() => {
    if (!project?.blueprint || nodes.length === 0) {
      setColumns([])
      return
    }

    const bp = project.blueprint

    // Derive column depth from the dependency graph
    const depthMap = new Map<string, number>()

    function getDepth(label: string, visited = new Set<string>()): number {
      if (depthMap.has(label)) return depthMap.get(label)!
      if (visited.has(label)) return 0
      visited.add(label)
      const section = bp.find(s => s.label === label)
      if (!section?.dependsOn?.length) {
        depthMap.set(label, 0)
        return 0
      }
      const d = 1 + Math.max(...section.dependsOn.map(dep => getDepth(dep, new Set(visited))))
      depthMap.set(label, d)
      return d
    }

    for (const s of bp) getDepth(s.label)

    // Group by depth
    const colGroups = new Map<number, string[]>()
    for (const s of bp) {
      const depth = depthMap.get(s.label) ?? 0
      if (!colGroups.has(depth)) colGroups.set(depth, [])
      if (!colGroups.get(depth)!.includes(s.label)) {
        colGroups.get(depth)!.push(s.label)
      }
    }

    const sorted = [...colGroups.entries()].sort(([a], [b]) => a - b)
    const entries: ColumnInfo[] = sorted.map(([col]) => ({
      label: col === 0
        ? 'Foundation'
        : col === sorted.length - 1
        ? 'Integration'
        : `Phase ${col + 1}`,
      col,
      left:  ORIGIN_X + col * (NODE_W + GAP_X) - GAP_X / 2,
      width: NODE_W + GAP_X,
    }))

    setColumns(entries)
  }, [project?.blueprint, nodes])

  if (columns.length === 0) return null

  return (
    <>
      {columns.map(col => (
        <div
          key={col.col}
          style={{
            position: 'absolute',
            top: 54,
            left: col.left,
            width: col.width,
            height: 'calc(100% - 60px)',
            background: LANE_COLORS[col.col % LANE_COLORS.length],
            borderLeft: col.col > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none',
            borderRight: '1px solid rgba(255,255,255,0.03)',
            pointerEvents: 'none',
            transition: 'background 0.3s',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -44,
              left: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.15)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {col.label}
            </span>
            <span
              style={{
                fontSize: 9,
                color: 'rgba(255,255,255,0.08)',
                fontWeight: 400,
              }}
            >
              col {col.col}
            </span>
          </div>
        </div>
      ))}
    </>
  )
}
