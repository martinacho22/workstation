import { useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './ApiKeyModal.module.css'

export default function ApiKeyModal() {
  const { apiKeyModalVisible, hideApiKeyModal, setApiKey, apiKey } = useWorkstationStore()
  const [val, setVal] = useState(apiKey || '')
  const [show, setShow] = useState(false)

  if (!apiKeyModalVisible) return null

  function save() {
    if (!val.trim()) return
    setApiKey(val.trim())
    hideApiKeyModal()
  }

  return (
    <div className={styles.overlay} onClick={hideApiKeyModal}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.icon}>🔑</div>
        <h2 className={styles.title}>Anthropic API Key Required</h2>
        <p className={styles.desc}>
          The reasoning chat uses Claude API (Haiku for handoff docs, Sonnet for chat).
          Your key is stored locally — never sent anywhere except Anthropic.
        </p>

        <div className={styles.inputRow}>
          <input
            className={styles.input}
            type={show ? 'text' : 'password'}
            placeholder="sk-ant-..."
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save() }}
            autoFocus
          />
          <button className={styles.toggleBtn} onClick={() => setShow(v => !v)}>
            {show ? '🙈' : '👁'}
          </button>
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={hideApiKeyModal}>Cancel</button>
          <button className={styles.saveBtn} onClick={save} disabled={!val.trim()}>
            Save & Continue
          </button>
        </div>

        <p className={styles.hint}>
          Get your key at{' '}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>
        </p>
      </div>
    </div>
  )
}
