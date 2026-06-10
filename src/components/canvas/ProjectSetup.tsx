import { useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './ProjectSetup.module.css'

interface Props {
  onDone: () => void
}

export default function ProjectSetup({ onDone }: Props) {
  const { createProject } = useWorkstationStore()
  const [name, setName]         = useState('')
  const [description, setDesc]  = useState('')
  const [stack, setStack]       = useState('')
  const [repoPath, setRepoPath] = useState('')

  function create() {
    if (!name.trim()) return
    createProject({
      name:        name.trim(),
      description: description.trim(),
      stack:       stack.trim(),
      repoPath:    repoPath.trim() || undefined,
    })
    onDone()
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <h1 className={styles.title}>New project</h1>
        <p className={styles.subtitle}>
          After setup, Workstation will interview you about your project before generating a build plan.
        </p>

        <div className={styles.fields}>
          <label className={styles.label}>Project name</label>
          <input
            className={styles.input}
            placeholder="e.g. Payments Refactor"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && create()}
            autoFocus
          />

          <label className={styles.label}>
            Description <span className={styles.optional}>(optional)</span>
          </label>
          <input
            className={styles.input}
            placeholder="What are you building?"
            value={description}
            onChange={e => setDesc(e.target.value)}
          />

          <label className={styles.label}>
            Stack <span className={styles.optional}>(optional — helps Claude give better advice)</span>
          </label>
          <input
            className={styles.input}
            placeholder="e.g. Next.js, Supabase, Stripe"
            value={stack}
            onChange={e => setStack(e.target.value)}
          />

          <label className={styles.label}>
            Local repo path <span className={styles.optional}>(optional — injected into context)</span>
          </label>
          <input
            className={styles.input}
            placeholder="e.g. /Users/you/projects/myapp"
            value={repoPath}
            onChange={e => setRepoPath(e.target.value)}
          />
        </div>

        <button
          className={styles.createBtn}
          onClick={create}
          disabled={!name.trim()}
        >
          Create project
        </button>
      </div>
    </div>
  )
}
