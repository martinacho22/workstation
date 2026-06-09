import { useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './Toolbar.module.css'

export default function Toolbar() {
  const { project, addSectionNode, activeNodeId, addTangentNode, toggleRoadmap, roadmapVisible } = useWorkstationStore()
  const [newName, setNewName] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [mode, setMode]           = useState<'section' | 'tangent'>('section')

  const nodes = useWorkstationStore(s => s.nodes)
  const progress = Math.round(
    (nodes.filter(n => n.data.status === 'done').length / Math.max(nodes.filter(n => n.data.kind !== 'handoff').length, 1)) * 100
  )

  function openAdd(m: 'section' | 'tangent') {
    setMode(m)
    setShowInput(true)
    setNewName('')
  }

  function confirm() {
    if (!newName.trim()) return
    if (mode === 'section') {
      addSectionNode(newName.trim())
    } else if (activeNodeId) {
      addTangentNode(activeNodeId, newName.trim())
    }
    setShowInput(false)
    setNewName('')
  }

  return (
    <div className={styles.toolbar}>
      {/* Project name */}
      <span className={styles.projectName}>
        <span className={styles.icon}>◈</span>
        {project?.name || 'Workstation'}
      </span>

      {/* Progress pill */}
      <div className={styles.progressPill}>
        <div className={styles.progressBar} style={{ width: `${progress}%` }} />
        <span className={styles.progressLabel}>{progress}%</span>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button className={styles.btn} onClick={() => openAdd('section')} title="Add section">
          + Section
        </button>
        <button
          className={styles.btn}
          onClick={() => openAdd('tangent')}
          disabled={!activeNodeId}
          title={activeNodeId ? 'Add tangent to active node' : 'Select a node first'}
        >
          ↓ Tangent
        </button>
        <button
          className={`${styles.btn} ${roadmapVisible ? styles.btnActive : ''}`}
          onClick={toggleRoadmap}
          title="Toggle roadmap overlay"
        >
          ⊞ Roadmap
        </button>
      </div>

      {/* Inline name input */}
      {showInput && (
        <div className={styles.inputOverlay}>
          <input
            autoFocus
            className={styles.nameInput}
            placeholder={mode === 'section' ? 'Section name…' : 'Tangent label…'}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') confirm()
              if (e.key === 'Escape') setShowInput(false)
            }}
          />
          <button className={styles.confirmBtn} onClick={confirm}>Add</button>
          <button className={styles.cancelBtn} onClick={() => setShowInput(false)}>✕</button>
        </div>
      )}
    </div>
  )
}
