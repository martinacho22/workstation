import { useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import { DeployTarget } from '@/types'
import BlueprintModal from './BlueprintModal'
import styles from './Toolbar.module.css'

const DEPLOY_TARGETS: { label: string; value: DeployTarget }[] = [
  { label: 'Vercel',  value: 'vercel'  },
  { label: 'Railway', value: 'railway' },
  { label: 'Fly.io',  value: 'fly'     },
  { label: 'Netlify', value: 'netlify' },
]

export default function Toolbar() {
  const {
    project, addSectionNode, activeNodeId, addTangentNode,
    toggleRoadmap, roadmapVisible, addDeployNode,
  } = useWorkstationStore()

  const [newName, setNewName] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [showTangentHint, setShowTangentHint] = useState(false)
  const [showBlueprint, setShowBlueprint] = useState(false)
  const [showDeployMenu, setShowDeployMenu] = useState(false)

  const nodes = useWorkstationStore(s => s.nodes)
  const progress = Math.round(
    (nodes.filter(n => n.data.status === 'done' && n.data.kind !== 'handoff').length /
     Math.max(nodes.filter(n => n.data.kind !== 'handoff').length, 1)) * 100
  )

  const hasDeployNode = nodes.some(n => n.data.kind === 'deploy')

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

  function handleDeploySelect(target: DeployTarget) {
    addDeployNode(target)
    setShowDeployMenu(false)
  }

  return (
    <>
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
          <button
            className={`${styles.btn} ${styles.blueprintBtn}`}
            onClick={() => setShowBlueprint(true)}
            title="Generate blueprint from idea"
          >
            Blueprint
          </button>

          <button className={styles.btn} onClick={openAddSection} title="Add section">
            + Section
          </button>

          <div className={styles.tangentWrapper}>
            <button
              className={`${styles.btn} ${!activeNodeId ? styles.btnMuted : ''}`}
              onClick={handleTangentClick}
              title="Add tangent — click a node first"
            >
              Tangent
            </button>
            {showTangentHint && (
              <div className={styles.tangentHint}>
                Click a node first, then add a tangent
              </div>
            )}
          </div>

          {!hasDeployNode && (
            <div className={styles.deployWrapper}>
              <button
                className={`${styles.btn} ${styles.deployBtn}`}
                onClick={() => setShowDeployMenu(v => !v)}
                title="Add deploy node"
              >
                Deploy
              </button>
              {showDeployMenu && (
                <div className={styles.deployMenu}>
                  {DEPLOY_TARGETS.map(t => (
                    <button
                      key={t.value}
                      className={styles.deployOption}
                      onClick={() => handleDeploySelect(t.value)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            className={`${styles.btn} ${roadmapVisible ? styles.btnActive : ''}`}
            onClick={toggleRoadmap}
            title="Toggle roadmap overlay"
          >
            Roadmap
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

      {showBlueprint && <BlueprintModal onClose={() => setShowBlueprint(false)} />}
    </>
  )
}
