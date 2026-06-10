import { useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './Toolbar.module.css'

interface Props {
  onNewProject?: () => void
}

export default function Toolbar({ onNewProject }: Props) {
  const { project, addSectionNode, nodes } = useWorkstationStore()
  const [showInput, setShowInput] = useState(false)
  const [newName, setNewName] = useState('')

  const sections = nodes.filter(n => n.data.kind === 'section')
  const done     = sections.filter(n => n.data.status === 'done').length
  const total    = sections.length
  const blocked  = sections.filter(n => n.data.status === 'blocked').length

  function handleAdd() {
    if (!newName.trim()) return
    addSectionNode(newName.trim())
    setNewName('')
    setShowInput(false)
  }

  if (!project) {
    return (
      <div className={styles.toolbar}>
        <div className={styles.left}>
          <span className={styles.projectName}>Workstation</span>
        </div>
        <div className={styles.actions}>
          {onNewProject && (
            <button className={`${styles.btn} ${styles.primaryBtn}`} onClick={onNewProject}>
              New project
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.toolbar}>
      <div className={styles.left}>
        <span className={styles.projectName}>{project.name}</span>
        {total > 0 && (
          <span className={styles.progress}>
            {done}/{total}
            {blocked > 0 && <span className={styles.blockedCount}> · {blocked} blocked</span>}
          </span>
        )}
      </div>

      <div className={styles.actions}>
        {showInput ? (
          <div className={styles.inputRow}>
            <input
              autoFocus
              className={styles.input}
              placeholder="Section name..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAdd()
                if (e.key === 'Escape') { setShowInput(false); setNewName('') }
              }}
            />
            <button className={styles.confirmBtn} onClick={handleAdd}>Add</button>
            <button className={styles.cancelBtn} onClick={() => { setShowInput(false); setNewName('') }}>Cancel</button>
          </div>
        ) : (
          <button className={styles.btn} onClick={() => setShowInput(true)}>
            + Section
          </button>
        )}
      </div>
    </div>
  )
}
