import { useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './Toolbar.module.css'

export default function Toolbar() {
  const {
    project, addSectionNode, activeNodeId, addTangentNode,
    toggleRoadmap, roadmapVisible, showApiKeyModal, apiKey,
  } = useWorkstationStore()
  const [newName, setNewName] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [showTangentHint, setShowTangentHint] = useState(false)

  const nodes = useWorkstationStore(s => s.nodes)
  const progress = Math.round(
    (nodes.filter(n => n.data.status === 'done' && n.data.kind !== 'handoff').length /
     Math.max(nodes.filter(n => n.data.kind !== 'handoff').length, 1)) * 100
  )

  function openAddSection() {
    setShowInput(true)
    setNewName('')
  }

  function handleTangentClick() {
    if (!activeNodeId) {
      setShowTangentHint(true)
      setTimeout(() => setShowTangentHint(false), 2500)
      return
    }
    const label = window.prompt('Name this tangent:')
    if (label?.trim()) addTangentNode(activeNodeId, label.trim())
  }

  function confirm() {
    if (!newName.trim()) return
    addSectionNode(newName.trim())
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
        <button className={styles.btn} onClick={openAddSection} title="Add section">
          + Section
        </button>

        <div className={styles.tangentWrapper}>
          <button
            className={`${styles.btn} ${!activeNodeId ? styles.btnMuted : ''}`}
            onClick={handleTangentClick}
            title="Add tangent — click a node first"
          >
            ↓ Tangent
          </button>
          {showTangentHint && (
            <div className={styles.tangentHint}>
              Click a node first, then add a tangent
            </div>
          )}
        </div>

        <button
          className={`${styles.btn} ${roadmapVisible ? styles.btnActive : ''}`}
          onClick={toggleRoadmap}
          title="Toggle roadmap overlay"
        >
          ⊞ Roadmap
        </button>

        <button
          className={`${styles.btn} ${!apiKey ? styles.btnWarn : ''}`}
          onClick={showApiKeyModal}
          title={apiKey ? 'API key set ✓' : 'Set API key'}
        >
          {apiKey ? '🔑 ✓' : '🔑 Set Key'}
        </button>
      </div>

      {/* Inline name input */}
      {showInput && (
        <div className={styles.inputOverlay}>
          <input
            autoFocus
            className={styles.nameInput}
            placeholder="Section name…"
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
