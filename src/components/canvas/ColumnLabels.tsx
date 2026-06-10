/**
 * ColumnLabels
 *
 * Renders faint phase-column labels and background washes on the canvas.
 * The layout engine places nodes in columns (col 0, col 1, col 2, …).
 * This component reads the node positions and project blueprint to:
 *
 * 1. Group nodes by column (inferred from x-position)
 * 2. Render a faint rgba wash behind each column group
 * 3. Render a column header label at the top
 *
 * The column headers give the canvas a reading direction: left → right is time,
 * same column = parallel work.
 */

import { useEffect, useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'

const NODE_W     = 240
const GAP_X      = 120
const ORIGIN_X   = 80
const COL_WIDTH  = NODE_W + GAP_X

const LANE_COLORS = [
  'rgba(124,158,255,0.025)',
  'rgba(74,222,128,0.025)',
  'rgba(240,192,64,0.02)',
  'rgba(192,132,252,0.025)',
  'rgba(255,124,124,0.02)',
  'rgba(74,192,222,0.025)',
]

const HEADER_LABELS = [
  'Foundation',
  'Core',
  'Features',
  'Integration',
  'Polish',
  'Final',
]

interface Col {
  index: number
  label: string
  x:     number
  color: string
  count: number
  nodeCenters: { label: string; status: string; y: number }[]
}

export default function ColumnLabels() {
  const { nodes, project } = useWorkstationStore()
  const [cols, setCols] = useState<Col[]>([])

  useEffect(() => {
    if (!project?.blueprint || nodes.length === 0) { setCols([]); return }

    const sections = nodes.filter(n => n.data.kind === 'section')
    if (sections.length === 0) { setCols([]); return }

    // Infer column from x-position
    const colMap = new Map<number, Col>()

    sections.forEach(node => {
      const col = Math.round((node.position.x - ORIGIN_X) / COL_WIDTH)
      if (col < 0) return

      if (!colMap.has(col)) {
        colMap.set(col, {
          index: col,
          label: HEADER_LABELS[Math.min(col, HEADER_LABELS.length - 1)] ?? `Phase ${col + 1}`,
          x:     ORIGIN_X + col * COL_WIDTH,
          color: LANE_COLORS[col % LANE_COLORS.length],
          count: 0,
          nodeCenters: [],
        })
      }

      const entry = colMap.get(col)!
      entry.count++
      entry.nodeCenters.push({
        label:  node.data.label,
        status: node.data.status,
        y:      node.position.y,
      })
    })

    // Sort by column index
    const sortedCols = [...colMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, col]) => col)

    setCols(sortedCols)
  }, [nodes, project?.blueprint])

  if (cols.length === 0) return null

  return (
    <div style={{
      position: 'absolute',
      top:      0,
      left:     0,
      width:    '100%',
      height:   '100%',
      pointerEvents: 'none',
      zIndex:   1,
    }}>
      {cols.map(col => (
        <div key={col.index} style={{
          position: 'absolute',
          left:     col.x,
          top:      '45%',
          width:    NODE_W,
          pointerEvents: 'none',
        }}>
          {/* Column header */}
          <div style={{
            fontSize:      10,
            fontWeight:    600,
            color:         'rgba(255,255,255,0.06)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textAlign:     'center',
            marginBottom:  8,
            transition:    'color 0.3s',
          }}>
            <span style={{ display: 'block', fontSize: 8, opacity: 0.4, marginBottom: 2 }}>
              Col {col.index + 1} · {col.count} phase{col.count > 1 ? 's' : ''}
            </span>
            {col.label}
          </div>

          {/* Faint vertical line to visually anchor the column */}
          <div style={{
            width:             '1px',
            height:            '100vh',
            background:        'rgba(255,255,255,0.015)',
            margin:            '0 auto',
            transition:        'background 0.3s',
          }} />
        </div>
      ))}
    </div>
  )
}
