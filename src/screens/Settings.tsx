import { useState } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './Settings.module.css'

type Tab = 'api' | 'terminal' | 'models' | 'appearance' | 'about'

const MODELS = [
  { id: 'claude-haiku-3-5',  label: 'Claude Haiku 3.5',  desc: 'Fastest. Best for handoff docs and small tasks.', cost: '$' },
  { id: 'claude-sonnet-3-7', label: 'Claude Sonnet 3.7', desc: 'Balanced. Best for planning and reasoning chats.', cost: '$$' },
  { id: 'claude-opus-4',     label: 'Claude Opus 4',     desc: 'Most capable. Best for complex architecture decisions.', cost: '$$$' },
]

export default function Settings() {
  const { apiKey, setApiKey } = useWorkstationStore()
  const [tab, setTab] = useState<Tab>('api')
  const [keyInput, setKeyInput] = useState(apiKey ?? '')
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [reasoningModel, setReasoningModel] = useState('claude-sonnet-3-7')
  const [handoffModel, setHandoffModel] = useState('claude-haiku-3-5')
  const [skipPerms, setSkipPerms] = useState(false)
  const [dangerAck, setDangerAck] = useState(false)
  const [accentColor, setAccentColor] = useState('#00ff88')
  const [claudePath, setClaudePath] = useState('/usr/local/bin/claude')

  function saveKey() {
    setApiKey(keyInput)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'api',        label: 'API Keys'    },
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
        {/* Sidebar */}
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

        {/* Panel */}
        <div className={styles.panel}>

          {tab === 'api' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Anthropic API Key</div>
              <div className={styles.sectionDesc}>
                Used for reasoning chats, handoff doc generation, and blueprints.
                Claude Code terminals use your local subscription — not this key.
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
              <div className={styles.keyNote}>
                Your key is stored locally on this machine. It never leaves your device.
              </div>
              <button className={styles.saveBtn} onClick={saveKey}>
                {saved ? '✓ Saved' : 'Save Key'}
              </button>
            </div>
          )}

          {tab === 'terminal' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Claude Code CLI Path</div>
              <div className={styles.sectionDesc}>
                Path to your Claude Code CLI binary. Run <code>which claude</code> in your terminal to find it.
              </div>
              <input
                className={styles.field}
                placeholder="/usr/local/bin/claude"
                value={claudePath}
                onChange={e => setClaudePath(e.target.value)}
              />

              <div className={styles.divider} />

              <div className={styles.sectionTitle}>Permissions Mode</div>
              <div className={styles.sectionDesc}>
                Controls how Claude Code handles permission prompts in terminal nodes.
              </div>

              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>Standard Mode</div>
                  <div className={styles.toggleDesc}>Claude Code will ask before executing potentially destructive commands.</div>
                </div>
                <div className={`${styles.toggle} ${!skipPerms ? styles.toggleOn : ''}`} onClick={() => setSkipPerms(false)} />
              </div>

              <div className={`${styles.dangerBox} ${skipPerms ? styles.dangerActive : ''}`}>
                <div className={styles.toggleRow}>
                  <div>
                    <div className={styles.toggleLabel} style={{ color: '#f87171' }}>Skip Permissions — Dangerous</div>
                    <div className={styles.toggleDesc}>Passes <code>--dangerously-skip-permissions</code> to Claude Code. Use only if you know what you're doing.</div>
                  </div>
                  <div className={`${styles.toggle} ${skipPerms ? styles.toggleDanger : ''}`} onClick={() => {
                    if (!skipPerms && !dangerAck) {
                      if (window.confirm('This disables permission prompts in Claude Code. Claude can execute any command without asking. Are you sure?')) {
                        setDangerAck(true)
                        setSkipPerms(true)
                      }
                    } else {
                      setSkipPerms(v => !v)
                    }
                  }} />
                </div>
              </div>
            </div>
          )}

          {tab === 'models' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Reasoning Chat Model</div>
              <div className={styles.sectionDesc}>Used for planning chats, architecture decisions, and overview chat.</div>
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
              <div className={styles.sectionDesc}>Used for auto-generating handoff documents. Haiku recommended — fast and cost-effective.</div>
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

          {tab === 'appearance' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Accent Color</div>
              <div className={styles.sectionDesc}>The primary highlight color used across the canvas and UI.</div>
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
              <div className={styles.sectionDesc}>Dot grid is the default. Adjust to preference.</div>
              <div className={styles.radioGroup}>
                {['Dot Grid', 'Line Grid', 'None'].map(opt => (
                  <label key={opt} className={styles.radioLabel}>
                    <input type="radio" name="bg" defaultChecked={opt === 'Dot Grid'} /> {opt}
                  </label>
                ))}
              </div>
            </div>
          )}

          {tab === 'about' && (
            <div className={styles.section}>
              <div className={styles.aboutLogo}>W</div>
              <div className={styles.aboutName}>Workstation</div>
              <div className={styles.aboutVersion}>v0.1.0 — Early Access</div>
              <div className={styles.aboutDesc}>
                An infinite canvas for developers using Claude. Organized, streamlined, terminal-first.
              </div>
              <div className={styles.divider} />
              <div className={styles.aboutRow}><span>Built with</span><span>Electron · React · TypeScript · react-flow</span></div>
              <div className={styles.aboutRow}><span>AI</span><span>Claude (Anthropic)</span></div>
              <div className={styles.aboutRow}><span>Terminal</span><span>node-pty · xterm.js</span></div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
