/**
 * Edge types for Workstation canvas.
 *
 * DependencyEdge — solid, dim white. Auto-generated from blueprint.
 *   Means: "B cannot start until A is done."
 *   Turns amber when the SOURCE node is blocked.
 *
 * FlowEdge — dashed, blue accent. User-created.
 *   Means: "Output of A feeds input of B."
 *
 * Both show a tooltip on hover explaining the relationship.
 */

import { useCallback, useState } from 'react'
import {
  BaseEdge,
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
} from '@xyflow/react'
import { useWorkstationStore } from '@/store/useWorkstationStore'

// ── Dependency Edge ──────────────────────────────────────────────────────────

export function DependencyEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  markerEnd,
  source, target,
  data,
}: EdgeProps) {
  const nodes = useWorkstationStore(s => s.nodes)
  const [hovered, setHovered] = useState(false)

  const sourceNode = nodes.find(n => n.id === source)
  const targetNode = nodes.find(n => n.id === target)

  // Turn amber if source is blocked
  const isBlocked  = sourceNode?.data.status === 'blocked'
  const isDone     = sourceNode?.data.status === 'done'

  const strokeColor = isBlocked
    ? 'rgba(240,192,64,0.7)'   // amber — upstream blocked
    : isDone
    ? 'rgba(74,222,128,0.25)'  // faint green — upstream done
    : 'rgba(255,255,255,0.1)'  // default dim

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const tooltipText = data?.reason
    ? String(data.reason)
    : targetNode && sourceNode
    ? `${targetNode.data.label} requires ${sourceNode.data.label}`
    : 'Dependency'

  return (
    <>
      {/* Invisible wide hit area for hover */}
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={16}
        fill="none"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'default' }}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth: isBlocked ? 1.5 : 1.5,
          transition: 'stroke 0.25s',
          pointerEvents: 'none',
        }}
      />
      {hovered && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -100%) translate(${labelX}px,${labelY - 8}px)`,
              pointerEvents: 'none',
              zIndex: 9999,
            }}
          >
            <div style={{
              background: 'rgba(10,10,18,0.95)',
              border: `1px solid ${isBlocked ? 'rgba(240,192,64,0.35)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 11,
              color: isBlocked ? 'rgba(240,192,64,0.9)' : 'rgba(255,255,255,0.55)',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}>
              {isBlocked && '⚠ '}
              {tooltipText}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

// ── Flow Edge ────────────────────────────────────────────────────────────────
// Dashed blue — user-created, means "output feeds input"

export function FlowEdge({
  id,
  sourceX, sourceY,
  targetX, targetY,
  sourcePosition, targetPosition,
  markerEnd,
  source, target,
  data,
}: EdgeProps) {
  const nodes = useWorkstationStore(s => s.nodes)
  const [hovered, setHovered] = useState(false)

  const sourceNode = nodes.find(n => n.id === source)
  const targetNode = nodes.find(n => n.id === target)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const tooltipText = data?.reason
    ? String(data.reason)
    : sourceNode && targetNode
    ? `Output of ${sourceNode.data.label} flows into ${targetNode.data.label}`
    : 'Data flow'

  return (
    <>
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={16}
        fill="none"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'default' }}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: 'rgba(124,158,255,0.45)',
          strokeWidth: 1.5,
          strokeDasharray: '5 4',
          pointerEvents: 'none',
        }}
      />
      {hovered && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -100%) translate(${labelX}px,${labelY - 8}px)`,
              pointerEvents: 'none',
              zIndex: 9999,
            }}
          >
            <div style={{
              background: 'rgba(10,10,18,0.95)',
              border: '1px solid rgba(124,158,255,0.25)',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 11,
              color: 'rgba(124,158,255,0.8)',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}>
              {tooltipText}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

// Legacy aliases — kept to avoid import errors
export const TangentEdge = DependencyEdge
export const TiebackEdge = FlowEdge
