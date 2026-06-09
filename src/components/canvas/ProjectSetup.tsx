import { useState } from 'react'
import { nanoid } from 'nanoid'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './ProjectSetup.module.css'

interface Props {
  onDone: () => void
}

const ACCENT_COLORS = [
  { label: 'Green',  value: '#00ff88' },
  { label: 'Cyan',   value: '#00d4ff' },
  { label: 'Purple', value: '#8888ff' },
  { label: 'Pink',   value: '#ff44aa' },
  { label: 'Orange', value: '#ff8844' },
]

export default function ProjectSetup({ onDone }: Props) {
  const { setProject, addSectionNode } = useWorkstationStore()
  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [stack, setStack]             = useState('')
  const [accent, setAccent]           = useState('#00ff88')

  function create() {
    if (!name.trim()) return
    setProject({
      id:          nanoid(),
      name:        name.trim(),
      description: description.trim(),
      stack:       stack.trim(),
      accentColor: accent,
      createdAt:   Date.now(),
      updatedAt:   Date.now(),
    })
    // Seed first section
    addSectionNode('Getting Started')
    onDone()
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.icon}>◈</div>
        <h1 className={styles.title}>New Workstation</h1>
        <p className={styles.subtitle}>Set up your project canvas</p>

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

          <label className={styles.label}>Description <span className={styles.optional}>(optional)</span></label>
          <input
            className={styles.input}
            placeholder="What are you building?"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />

          <label className={styles.label}>Stack <span className={styles.optional}>(optional)</span></label>
          <input
            className={styles.input}
            placeholder="e.g. Next.js, Supabase, Stripe"
            value={stack}
            onChange={e => setStack(e.target.value)}
          />

          <label className={styles.label}>Accent color</label>
          <div className={styles.colorRow}>
            {ACCENT_COLORS.map(c => (
              <button
                key={c.value}
                className={`${styles.colorBtn} ${accent === c.value ? styles.colorSelected : ''}`}
                style={{ '--color': c.value } as React.CSSProperties}
                onClick={() => setAccent(c.value)}
                title={c.label}
              />
            ))}
          </div>
        </div>

        <button
          className={styles.createBtn}
          style={{ '--accent': accent } as React.CSSProperties}
          onClick={create}
          disabled={!name.trim()}
        >
          Create Workstation →
        </button>
      </div>
    </div>
  )
}
