import { useState, useEffect } from 'react'
import styles from './Setup.module.css'

type Step = 'install' | 'auth' | 'ready'

type CLIStatus = {
  installed: boolean
  authenticated: boolean
  version: string | null
  path: string | null
  error: string | null
  rawError?: string
}

const INSTALL_CMD = 'npm install -g @anthropic-ai/claude-code'

interface SetupProps {
  onComplete: () => void
}

export default function Setup({ onComplete }: SetupProps) {
  const [step, setStep]         = useState<Step>('install')
  const [status, setStatus]     = useState<CLIStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const [fixing, setFixing]     = useState(false)
  const [fixResult, setFixResult] = useState<string | null>(null)
  const [copied, setCopied]     = useState(false)

  // On mount — check if already installed + authed
  useEffect(() => {
    runCheck(true)
  }, [])

  async function runCheck(silent = false) {
    if (!silent) setChecking(true)
    setFixResult(null)

    const electron = (window as any).electron
    if (!electron?.claude?.status) {
      // Browser mode — skip
      onComplete()
      return
    }

    const result: CLIStatus = await electron.claude.status()
    setStatus(result)

    if (result.installed && result.authenticated) {
      setStep('ready')
    } else if (result.installed && !result.authenticated) {
      setStep('auth')
    } else {
      setStep('install')
    }

    setChecking(false)
  }

  async function handleFix() {
    setFixing(true)
    setFixResult(null)
    const electron = (window as any).electron
    const result = await electron.claude.fixAuth()
    setFixResult(result.message)
    setFixing(false)
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>

        {/* Logo */}
        <div className={styles.logo}>W</div>
        <h1 className={styles.title}>Workstation</h1>
        <p className={styles.subtitle}>Connect Claude to get started</p>

        {/* Step indicators */}
        <div className={styles.steps}>
          <div className={`${styles.stepDot} ${step === 'install' ? styles.active : (step === 'auth' || step === 'ready') ? styles.done : ''}`}>
            <span>1</span>
            <label>Install</label>
          </div>
          <div className={styles.stepLine} />
          <div className={`${styles.stepDot} ${step === 'auth' ? styles.active : step === 'ready' ? styles.done : ''}`}>
            <span>2</span>
            <label>Authenticate</label>
          </div>
          <div className={styles.stepLine} />
          <div className={`${styles.stepDot} ${step === 'ready' ? styles.done : ''}`}>
            <span>3</span>
            <label>Ready</label>
          </div>
        </div>

        {/* ── Step 1: Install ─────────────────────────────── */}
        {step === 'install' && (
          <div className={styles.stepContent}>
            <p className={styles.desc}>
              Workstation uses Claude Code CLI to run all AI tasks through your subscription — no API tokens needed for coding.
            </p>

            <div className={styles.codeBlock}>
              <code>{INSTALL_CMD}</code>
              <button
                className={styles.copyBtn}
                onClick={() => copyToClipboard(INSTALL_CMD)}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <ol className={styles.instructions}>
              <li>Open your terminal (Terminal.app, iTerm, or any shell)</li>
              <li>Paste and run the command above</li>
              <li>Wait for install to complete (~30 seconds)</li>
              <li>Click Check below</li>
            </ol>

            <div className={styles.actions}>
              <button
                className={styles.primaryBtn}
                onClick={() => runCheck()}
                disabled={checking}
              >
                {checking ? 'Checking...' : 'Check Installation'}
              </button>
              <button className={styles.ghostBtn} onClick={onComplete}>
                Skip for now
              </button>
            </div>

            {status && !status.installed && (
              <div className={styles.errorBox}>
                <strong>Not found.</strong> Make sure Node.js is installed first.{' '}
                <a href="https://nodejs.org" target="_blank" rel="noreferrer" className={styles.link}>
                  Download Node.js
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Authenticate ────────────────────────── */}
        {step === 'auth' && (
          <div className={styles.stepContent}>
            <div className={styles.versionBadge}>
              Claude CLI {status?.version} found at {status?.path}
            </div>

            <p className={styles.desc}>
              Now link your Anthropic account. This is a one-time step — Workstation will use your existing subscription.
            </p>

            {/* Normal auth flow */}
            {status?.error !== 'TOKEN_CONFLICT' && (
              <>
                <div className={styles.codeBlock}>
                  <code>claude</code>
                  <button className={styles.copyBtn} onClick={() => copyToClipboard('claude')}>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <ol className={styles.instructions}>
                  <li>Open your terminal</li>
                  <li>Run <strong>claude</strong></li>
                  <li>A browser window will open — log in to your Anthropic account</li>
                  <li>Return here and click Check</li>
                </ol>
              </>
            )}

            {/* Token conflict flow */}
            {status?.error === 'TOKEN_CONFLICT' && (
              <>
                <div className={styles.warningBox}>
                  <strong>Token conflict detected.</strong> Claude Desktop and Claude Code CLI are using conflicting auth tokens. This is a known issue — fix it in one click.
                </div>
                <ol className={styles.instructions}>
                  <li>Click <strong>Auto-Fix</strong> below — this clears the conflicting token and logs out cleanly</li>
                  <li>Open your terminal and run <strong>claude</strong> to re-authenticate</li>
                  <li>Return here and click Check</li>
                </ol>
              </>
            )}

            {fixResult && (
              <div className={styles.infoBox}>{fixResult}</div>
            )}

            <div className={styles.actions}>
              {status?.error === 'TOKEN_CONFLICT' && (
                <button
                  className={styles.warningBtn}
                  onClick={handleFix}
                  disabled={fixing}
                >
                  {fixing ? 'Fixing...' : 'Auto-Fix Token Conflict'}
                </button>
              )}
              <button
                className={styles.primaryBtn}
                onClick={() => runCheck()}
                disabled={checking}
              >
                {checking ? 'Checking...' : 'Check Authentication'}
              </button>
              <button className={styles.ghostBtn} onClick={onComplete}>
                Skip for now
              </button>
            </div>

            {/* Show raw error for debugging */}
            {status?.rawError && (
              <details className={styles.rawError}>
                <summary>Show error details</summary>
                <pre>{status.rawError}</pre>
              </details>
            )}
          </div>
        )}

        {/* ── Step 3: Ready ───────────────────────────────── */}
        {step === 'ready' && (
          <div className={styles.stepContent}>
            <div className={styles.successIcon}>✓</div>
            <p className={styles.desc} style={{ textAlign: 'center' }}>
              Claude CLI {status?.version} is connected and authenticated.<br />
              All AI tasks will run through your subscription — no API tokens needed.
            </p>

            <div className={styles.readySummary}>
              <div className={styles.readyRow}>
                <span className={styles.readyLabel}>Coding</span>
                <span className={styles.readyValue}>Claude Code CLI (subscription)</span>
              </div>
              <div className={styles.readyRow}>
                <span className={styles.readyLabel}>Reasoning</span>
                <span className={styles.readyValue}>Claude Code CLI (subscription)</span>
              </div>
              <div className={styles.readyRow}>
                <span className={styles.readyLabel}>Handoff docs</span>
                <span className={styles.readyValue}>Claude Code CLI (subscription)</span>
              </div>
              <div className={styles.readyRow}>
                <span className={styles.readyLabel}>CLI path</span>
                <span className={styles.readyValue}>{status?.path}</span>
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.primaryBtn} onClick={onComplete}>
                Open Workstation
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
