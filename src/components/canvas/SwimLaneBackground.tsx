/**
 * SwimLaneBackground
 *
 * Renders faint vertical lanes behind nodes, grouped by blueprint column.
 * Each lane gets a subtle background wash and a column header so the
 * developer immediately sees the left→right reading direction of the project.
 *
 * Lanes are rendered as absolutely-positioned divs inside the ReactFlow
 * container. They sit below the nodes and above the dot-grid background.
 *
 * Uses the layout positions from applyBlueprint — col = column, row = row.
 * Ground truth: project.blueprint + node positions.
 */

import { useEffect, useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'

const LANE_WIDTH  = 320  // estimated column width on canvas (NODE_W + GAP_X)
const LANE_GAP    = 120  // horizontal gap between columns  
const ORIGIN_X    = 80   // matches layoutEngine.ts ORIGIN_X

// Colours cycle per column — very faint, just enough to distinguish
const LANE_COLORS = [
  'rgba(124,158,255,0.03)',   // blue wash
  'rgba(74,222,128,0.03)',    // green wash
  'rgba(240,192,64,0.03)',    // amber wash
  'rgba(192,132,252,0.03)',   // purple wash
  'rgba(255,124,124,0.03)',   // red wash
  'rgba(74,192,222,0.03)',    // cyan wash
]

interface Lane {
  col:    number
  label:  string
  x:      number
  width:  number
  height: number
  color:  string
}

export default function SwimLaneBackground() {
  const { nodes, project } = useWorkstationStore()
  const [lanes, setLanes] = useState<Lane[]>([])

  useEffect(() => {
    if (!project?.blueprint || nodes.length === 0) {
      setLanes([])
      return
    }

    const sections = nodes.filter(n => n.data.kind === 'section')
    if (sections.length === 0) { setLanes([]); return }

    // Find the min/max Y from actual node positions so the lane height
    // covers the full vertical extent of nodes in that column
    const colRanges = new Map<number, { minY: number; maxY: number }>()

    sections.forEach(node => {
      const label    = node.data.label
      const bpEntry = project.blueprint?.find(b => b.label === label)
      if (!bpEntry) return

      // col is NOT stored on the node at runtime — we need to infer it
      // from the node's x position relative to ORIGIN_X
      const col = Math.round((node.position.x - ORIGIN_X) / (LANE_WIDTH + LANE_GAP))
      if (col < 0) return

      const yStart = node.position.y
      const yEnd   = yStart + 160  // rough node height approx

      if (!colRanges.has(col)) {
        colRanges.set(col, { minY: yStart, maxY: yEnd })
      } else {
        const range = colRanges.get(col)!
        range.minY = Math.min(range.minY, yStart)
        range.maxY = Math.max(range.maxY, yEnd)
      }
    })

    // Build lanes from col ranges, sorted by col
    const sortedCols = [...colRanges.entries()].sort((a, b) => a[0] - b[0])
    const builtLanes: Lane[] = sortedCols.map(([col, range]) => {
      const x = ORIGIN_X + col * (LANE_WIDTH + LANE_GAP) - 24 // offset left to cover padding
      return {
        col,
        label: col === 0 ? 'Foundation' : col === sortedCols.length - 1 ? 'Final' : `Phase ${col + 1}`,
        x,
        width: LANE_WIDTH + 48,  // a bit wider than node zone
        height: range.maxY - range.minY + 120,
        color: LANE_COLORS[col % LANE_COLORS.length],
      }
    })

    setLanes(builtLanes)
  }, [nodes, project?.blueprint])

  if (lanes.length === 0) return null

  return (
    <div style={{
      position: 'absolute',
      top:      0,
      left:     0,
      width:    '100%',
      height:   '100%',
      pointerEvents: 'none',
      zIndex:   0,
    }}>
      {lanes.map(lane => (
        <div
          key={lane.col}
          style={{
            position: 'absolute',
            left:     lane.x,
            top:      lanes.reduce((min, l) => Math.min(min, l.height), Infinity) === lane.height
              ? undefined
              : 100,
            width:    lane.width,
            height:   '100%',
            background: lane.color,
            borderRight: '1px solid rgba(255,255,255,0.03)',
            borderRadius: 8,
          }}
        >
          {/* Column header — faint label above nodes */}
          <div style={{
            position: 'absolute',
            top:      8,
            left:     16,
            fontSize:  11,
            fontWeight: 600,
            color:     'rgba(255,255,255,0.08)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}>
            {lane.label}
            <span style={{ marginLeft: 8, fontWeight: 400, opacity: 0.5 }}>
              Col {lane.col + 1}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
