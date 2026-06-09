import { EdgeProps, getBezierPath, getStraightPath } from '@xyflow/react'

// ─── Flow Edge (main left → right) ───────────────────────────────────────────
export function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  return (
    <g>
      <path
        id={id}
        d={path}
        fill="none"
        stroke="rgba(0,255,136,0.35)"
        strokeWidth={1.5}
      />
      <path
        d={path}
        fill="none"
        stroke="rgba(0,255,136,0.08)"
        strokeWidth={6}
      />
    </g>
  )
}

// ─── Tangent Edge (open — dashed purple) ─────────────────────────────────────
export function TangentEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  return (
    <g>
      <path
        id={id}
        d={path}
        fill="none"
        stroke="rgba(136,136,255,0.5)"
        strokeWidth={1.5}
        strokeDasharray="5,4"
      />
    </g>
  )
}

// ─── Tieback Edge (resolved — curved back, green solid) ──────────────────────
export function TiebackEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.6,
  })
  return (
    <g>
      <path
        id={id}
        d={path}
        fill="none"
        stroke="rgba(0,255,136,0.6)"
        strokeWidth={1.5}
        markerEnd="url(#tieback-arrow)"
      />
      {/* Arrow marker */}
      <defs>
        <marker id="tieback-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="rgba(0,255,136,0.6)" />
        </marker>
      </defs>
    </g>
  )
}
