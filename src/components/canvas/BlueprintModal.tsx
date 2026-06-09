import { useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './BlueprintModal.module.css'

interface Props {
  onClose: () => void
}

export default function BlueprintModal({ onClose }: Props) {
  const [idea, setIdea] = useState('')
  const { generateBlueprint, blueprintLoading, blueprintError, apiKey, showApiKeyModal } = useWorkstationStore()

  async function handleGenerate() {
    if (!apiKey) { showApiKeyModal(); return }
    if (!idea.trim()) return
    await generateBlueprint(idea)
    if (!blueprintError) onClose()
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.icon}>🧬</span>
          <h2>Blueprint Generator</h2>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <p className={styles.subtitle}>
          Describe your project in plain English. Claude will break it into sections and populate your canvas.
        </p>

        <textarea
          className={styles.textarea}
          placeholder="e.g. A SaaS app where users can upload CSV files, visualize them as charts, and share dashboards with their team. Auth via Google, Postgres DB, deployed on Vercel."
          value={idea}
          onChange={e => setIdea(e.target.value)}
          rows={5}
          autoFocus
        />

        {blueprintError && (
          <div className={styles.error}>⚠ {blueprintError}</div>
        )}

        <div className={styles.footer}>
          <button className={styles.cancel} onClick={onClose}>Cancel</button>
          <button
            className={styles.generate}
            onClick={handleGenerate}
            disabled={blueprintLoading || !idea.trim()}
          >
            {blueprintLoading ? (
              <span className={styles.spinner}>⟳ Generating...</span>
            ) : (
              '⚡ Generate Blueprint'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
