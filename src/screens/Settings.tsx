import { useState, useEffect } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import { checkClaudeCliStatus } from '@/lib/claudeRunner'
import styles from './Settings.module.css'

type Tab = 'claude' | 'terminal' | 'models' | 'appearance' | 'about'

const MODELS = [
  { id: 'claude-haiku-4-5',  label: 'Claude Haiku',  desc: 'Fastest. Best for handoff docs and small tasks.', cost: '$' },
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet', desc: 'Balanced. Best for planning and reasoning chats.', cost: '$$' },
  { id: 'claude-opus-4',     label: 'Claude Opus',   desc: 'Most capable. Best for complex architecture decisions.', cost: '$$$' },
]

type CliStatus = {
  installed: boolean
  authenticated: boolean
  version: string | null
  error: string | null
} | null

export default function Settings() {
  const { apiKey, setApiKey, claudeCliPath, setClaudeCliPath } = useWorkstationStore()
  const [tab, setTab] = useState<Tab>('claude')
  const [keyInput, setKeyInput] = useState(apiKey ?? '')
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [reasoningModel, setReasoningModel] = useState('claude-sonnet-4-5')
  const [handoffModel, setHandoffModel] = useState('claude-haiku-4-5')
  const [skipPerms, setSkipPerms] = useState(false)
  const [dangerAck, setDangerAck] = useState(false)
  const [accentColor, setAccentColor] = useState('#00ff88')
  const [cliPathInput, setCliPathInput] = useState(claudeCliPath || 'claude')
  const [cliStatus, setCliStatus] = useState<CliStatus>(null)
  const [cliChecking, setCliChecking] = useState(false)

  useEffect(() => {
    // Auto-check CLI status on mount
    checkCli()
  }, [])

  async function checkCli() {
    setCliChecking(true)
    const status = await checkClaudeCliStatus()
    setCliStatus(status)
    setCliChecking(false)
  }

  function saveKey() {
    setApiKey(keyInput)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function saveCliPath() {
    setClaudeCliPath(cliPathInput)
    setTimeout(() => checkCli(), 300)
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'claude',     label: 'Claude'      },
    { id: 'terminal',   label: 'Terminal'    },
    { id: 'models',     label: 'Models'      },
    { id: 'appearance', label: 'Appearance'  },
    { id: 'about',      label: 'About'       },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Configure Workstation to match your setup.</p>
      </div>

      <div className={styles.layout}>
        <div className={styles.settingsSidebar}>
          {TABS.map(t => (
            <button
              key={t.id}
              className={`${styles.settingsTab} ${tab === t.id ? styles.activeSettingsTab : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.panel}>

          {/* ── Claude Tab ──────────────────────────────────────────── */}
          {tab === 'claude' && (
            <div className={styles.section}>

              {/* CLI Status Card */}
              <div className={styles.sectionTitle}>Claude CLI</div>
              <div className={styles.sectionDesc}>
                Workstation routes all AI calls through the Claude CLI by default —
                no API tokens consumed. Requires Claude Code to be installed and authenticated.
              </div>

              <div className={`${styles.statusCard} ${
                cliChecking ? styles.statusChecking :
                cliStatus?.authenticated ? styles.statusOk :
                cliStatus?.installed ? styles.statusWarn :
                styles.statusErr
              }`}>
                <div className={styles.statusDot} />
                <div className={styles.statusText}>
                  {cliChecking && 'Checking CLI status...'}
                  {!cliChecking && !cliStatus && 'Not running in Electron — CLI unavailable in browser mode'}
                  {!cliChecking && cliStatus?.authenticated && (
                    <>CLI connected · {cliStatus.version || 'version unknown'}</>
                  )}
                  {!cliChecking && cliStatus && !cliStatus.authenticated && cliStatus.installed && (
                    <>Installed but not authenticated — run <code>claude</code> in your terminal to log in</>
                  )}
                  {!cliChecking && cliStatus && !cliStatus.installed && (
                    <>Not installed — run: <code>npm install -g @anthropic-ai/claude-code</code></>
                  )}
                </div>
                <button className={styles.checkBtn} onClick={checkCli} disabled={cliChecking}>
                  {cliChecking ? '...' : 'Re-check'}
                </button>
              </div>

              <div className={styles.fieldRow}>
                <input
                  className={styles.field}
                  placeholder="claude"
                  value={cliPathInput}
                  onChange={e => setCliPathInput(e.target.value)}
                />
                <button className={styles.saveBtn} onClick={saveCliPath}>Save Path</button>
              </div>
              <div className={styles.keyNote}>
                Run <code>which claude</code> in your terminal to find the full path if needed.
              </div>

              <div className={styles.divider} />

              {/* API Key — fallback only */}
              <div className={styles.sectionTitle}>API Key — Fallback Only</div>
              <div className={styles.sectionDesc}>
                Only used if the Claude CLI is unavailable. If CLI is working, this key is never touched.
                Stored locally — never leaves your device.
              </div>
              <div className={styles.fieldRow}>
                <input
                  className={styles.field}
                  type={showKey ? 'text' : 'password'}
                  placeholder="sk-ant-..."
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                />
                <button className={styles.toggleBtn} onClick={() => setShowKey(v => !v)}>
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <button className={styles.saveBtn} onClick={saveKey}>
                {saved ? 'Saved' : 'Save Key'}
              </button>
            </div>
          )}

          {/* ── Terminal Tab ─────────────────────────────────────────── */}
          {tab === 'terminal' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Permissions Mode</div>
              <div className={styles.sectionDesc}>
                Controls how Claude Code handles permission prompts in terminal nodes.
              </div>

              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>Standard Mode</div>
                  <div className={styles.toggleDesc}>Claude Code will ask before executing potentially destructive commands.</div>
                </div>
                <div
                  className={`${styles.toggle} ${!skipPerms ? styles.toggleOn : ''}`}
                  onClick={() => setSkipPerms(false)}
                />
              </div>

              <div className={`${styles.dangerBox} ${skipPerms ? styles.dangerActive : ''}`}>
                <div className={styles.toggleRow}>
                  <div>
                    <div className={styles.toggleLabel} style={{ color: '#f87171' }}>Skip Permissions</div>
                    <div className={styles.toggleDesc}>
                      Passes <code>--dangerously-skip-permissions</code> to Claude Code.
                      Claude can execute any command without asking. Use with caution.
                    </div>
                  </div>
                  <div
                    className={`${styles.toggle} ${skipPerms ? styles.toggleDanger : ''}`}
                    onClick={() => {
                      if (!skipPerms && !dangerAck) {
                        if (window.confirm('This disables all permission prompts. Claude Code can execute any command without asking. Continue?')) {
                          setDangerAck(true)
                          setSkipPerms(true)
                        }
                      } else {
                        setSkipPerms(v => !v)
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Models Tab ───────────────────────────────────────────── */}
          {tab === 'models' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Reasoning Chat Model</div>
              <div className={styles.sectionDesc}>
                Used when CLI is unavailable (API fallback). In CLI mode the model is selected by your Claude subscription.
              </div>
              <div className={styles.modelList}>
                {MODELS.map(m => (
                  <div
                    key={m.id}
                    className={`${styles.modelCard} ${reasoningModel === m.id ? styles.modelActive : ''}`}
                    onClick={() => setReasoningModel(m.id)}
                  >
                    <div className={styles.modelTop}>
                      <span className={styles.modelName}>{m.label}</span>
                      <span className={styles.modelCost}>{m.cost}</span>
                    </div>
                    <div className={styles.modelDesc}>{m.desc}</div>
                  </div>
                ))}
              </div>

              <div className={styles.divider} />

              <div className={styles.sectionTitle}>Handoff Doc Model</div>
              <div className={styles.sectionDesc}>API fallback only. Haiku recommended.</div>
              <div className={styles.modelList}>
                {MODELS.map(m => (
                  <div
                    key={m.id}
                    className={`${styles.modelCard} ${handoffModel === m.id ? styles.modelActive : ''}`}
                    onClick={() => setHandoffModel(m.id)}
                  >
                    <div className={styles.modelTop}>
                      <span className={styles.modelName}>{m.label}</span>
                      <span className={styles.modelCost}>{m.cost}</span>
                    </div>
                    <div className={styles.modelDesc}>{m.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Appearance Tab ───────────────────────────────────────── */}
          {tab === 'appearance' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Accent Color</div>
              <div className={styles.sectionDesc}>Primary highlight color across canvas and UI.</div>
              <div className={styles.colorRow}>
                {['#00ff88', '#00c8ff', '#a855f7', '#f97316', '#f43f5e'].map(c => (
                  <div
                    key={c}
                    className={`${styles.colorSwatch} ${accentColor === c ? styles.colorActive : ''}`}
                    style={{ background: c }}
                    onClick={() => {
                      setAccentColor(c)
                      document.documentElement.style.setProperty('--accent', c)
                    }}
                  />
                ))}
                <input
                  type="color"
                  className={styles.colorPicker}
                  value={accentColor}
                  onChange={e => {
                    setAccentColor(e.target.value)
                    document.documentElement.style.setProperty('--accent', e.target.value)
                  }}
                />
              </div>

              <div className={styles.divider} />

              <div className={styles.sectionTitle}>Canvas Background</div>
              <div className={styles.radioGroup}>
                {['Dot Grid', 'Line Grid', 'None'].map(opt => (
                  <label key={opt} className={styles.radioLabel}>
                    <input type="radio" name="bg" defaultChecked={opt === 'Dot Grid'} /> {opt}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── About Tab ────────────────────────────────────────────── */}
          {tab === 'about' && (
            <div className={styles.section}>
              <div className={styles.aboutLogo}>W</div>
              <div className={styles.aboutName}>Workstation</div>
              <div className={styles.aboutVersion}>v0.1.0 — Early Access</div>
              <div className={styles.aboutDesc}>
                An infinite canvas for developers using Claude. Organized, streamlined, terminal-first.
                AI calls run through the Claude CLI — your subscription, not your API credits.
              </div>
              <div className={styles.divider} />
              <div className={styles.aboutRow}><span>Built with</span><span>Electron · React · TypeScript · react-flow</span></div>
              <div className={styles.aboutRow}><span>AI</span><span>Claude CLI (Anthropic) — subscription-powered</span></div>
              <div className={styles.aboutRow}><span>Terminal</span><span>node-pty · xterm.js</span></div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
