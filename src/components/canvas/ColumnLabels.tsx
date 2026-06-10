/**
 * ColumnLabels — phase swim lanes on the canvas.
 *
 * After the layout engine places nodes into columns (col 0, col 1, …),
 * this component renders:
 *  - A faint background wash per column (phase lane)
 *  - A column header label at the top of each lane
 *
 * Columns are scoped to the active project's blueprint phases.
 * Nodes at the same col are in the same lane visually.
 */

import { useEffect, useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'

interface ColumnInfo {
  label: string
  col:   number
  left:  number
  width: number
}

const LANE_COLORS = [
  'rgba(0,255,136,0.025)',
  'rgba(124,158,255,0.025)',
  'rgba(240,192,64,0.025)',
  'rgba(255,107,107,0.025)',
  'rgba(160,120,255,0.02)',
  'rgba(255,160,64,0.02)',
]

const HEADER_HEIGHT = 32
const NODE_W = 240
const GAP_X = 120
const ORIGIN_X = 60
const ORIGIN_Y = 60
const LANE_TOP = 54  // where lanes start (below header text)

export default function ColumnLabels() {
  const { project, nodes } = useWorkstationStore()
  const [columns, setColumns] = useState<ColumnInfo[]>([])

  useEffect(() => {
    if (!project?.blueprint || nodes.length === 0) {
      setColumns([])
      return
    }

    // Build col map from node positions: group nodes that are within
    // GAP_X/2 of each other horizontally
    const sectionNodes = nodes.filter(n => n.data.kind === 'section')
    if (sectionNodes.length === 0) {
      setColumns([])
      return
    }

    // Find the column of each section node based on its x position
    const nodeCols = new Map<string, number>()
    const sorted = [...sectionNodes].sort((a, b) => a.position.x - b.position.x)

    // Group into columns: nodes whose x positions differ by < NODE_W + GAP_X/2
    let currentCol = 0
    let lastX = -Infinity
    for (const n of sorted) {
      if (lastX === -Infinity || n.position.x - lastX > NODE_W + GAP_X / 2) {
        currentCol = 0  // Reset — we'll derive from blueprint instead
      }
      // Better: use blueprint dep positions
      lastX = n.position.x
    }

    // Derive columns from blueprint order + dependency depth
    const bp = project.blueprint
    const depthMap = new Map<string, number>()

    function getDepth(label: string, visited = new Set<string>()): number {
      if (depthMap.has(label)) return depthMap.get(label)!
      if (visited.has(label)) return 0
      visited.add(label)
      const section = bp.find(s => s.label === label)
      if (!section || !section.dependsOn || section.dependsOn.length === 0) {
        depthMap.set(label, 0)
        return 0
      }
      const d = 1 + Math.max(...section.dependsOn.map(dep => getDepth(dep, new Set(visited))))
      depthMap.set(label, d)
      return d
    }

    for (const s of bp) getDepth(s.label)

    // Group sections by depth
    const colGroups = new Map<number, string[]>()
    for (const s of bp) {
      const depth = depthMap.get(s.label) ?? 0
      if (!colGroups.has(depth)) colGroups.set(depth, [])
      if (!colGroups.get(depth)!.includes(s.label)) {
        colGroups.get(depth)!.push(s.label)
      }
    }

    // Build ColumnInfo from groups
    const colEntries: ColumnInfo[] = []
    const sortedCols = [...colGroups.entries()].sort(([a], [b]) => a - b)

    for (const [col, labels] of sortedCols) {
      const label = col === 0
        ? 'Foundation'
        : col === sortedCols.length - 1
        ? 'Integration'
        : `Phase ${col + 1}`

      colEntries.push({
        label,
        col,
        left: ORIGIN_X + col * (NODE_W + GAP_X) - GAP_X / 2,
        width: NODE_W + GAP_X,
      })
    }

    setColumns(colEntries)
  }, [project?.blueprint, nodes])

  if (columns.length === 0) return null

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 0,
      overflow: 'hidden',
    }}>
      {columns.map(col => (
        <div key={col.col} style={{
          position: 'absolute',
          top: LANE_TOP,
          left: col.left,
          width: col.width,
          height: `calc(100% - ${LANE_TOP}px)`,
          background: LANE_COLORS[col.col % LANE_COLORS.length],
          borderLeft: col.col > 0 ? '1px solid rgba(255,255,255,0.03)' : 'none',
          borderRight: '1px solid rgba(255,255,255,0.03)',
          transition: 'background 0.3s',
        }} />
      ))}

      {/* Column headers */}
      {columns.map(col => (
        <div key={`hdr-${col.col}`} style={{
          position: 'absolute',
          top: 10,
          left: col.left + 12,
          width: col.width,
          height: HEADER_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          pointerEvents: 'none',
        }}>
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.15)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            {col.label}
          </span>
          <span style={{
            fontSize: 9,
            color: 'rgba(255,255,255,0.08)',
            fontWeight: 400,
          }}>
            col {col.col}
          </span>
        </div>
      ))}
    </div>
  )
}
