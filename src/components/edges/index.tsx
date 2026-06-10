import { BaseEdge, EdgeProps, getStraightPath, getBezierPath } from '@xyflow/react'

export function FlowEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd }: EdgeProps) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  return (
    <BaseEdge
      path={edgePath}
      markerEnd={markerEnd}
      style={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1.5 }}
    />
  )
}

// Legacy exports — kept to avoid import errors during transition
export const TangentEdge = FlowEdge
export const TiebackEdge = FlowEdge
