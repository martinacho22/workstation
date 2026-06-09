import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useWorkstationStore } from '@xyflow/react'
import { useWorkstationStore as useStore } from '@/store/useWorkstationStore'
import { WorkstationNodeData, DeployTarget } from '@/types'
import NodeHeader from './NodeHeader'
import ChatPane from '../panes/ChatPane'
import styles from './DeployNode.module.css'

const PLATFORM_COMMANDS: Record<DeployTarget, string[]> = {
  vercel: [
    'npm install -g vercel',
    'vercel login',
    'vercel --prod',
  ],
  railway: [
    'npm install -g @railway/cli',
    'railway login',
    'railway up',
  ],
  fly: [
    'brew install flyctl',
    'fly auth login',
    'fly launch',
    'fly deploy',
  ],
  netlify: [
    'npm install -g netlify-cli',
    'netlify login',
    'netlify deploy --prod',
  ],
  none: [],
}

const PREFLIGHT_ITEMS = [
  'Build passes locally (npm run build)',
  'All env vars set below',
  'DB migrations run',
  'No open blocking bugs',
  'README updated',
]

interface Props {
  data: WorkstationNodeData
  id: string
}

export default function DeployNode({ data, id }: Props) {
  const { updateEnvVar, addEnvVar, updateNodeStatus } = useStore()
  const project = useStore(s => s.project)
  const [tab, setTab] = useState<'checklist' | 'env' | 'commands' | 'chat'>('checklist')
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [newKey, setNewKey] = useState('')

  const target = data.deployTarget || 'vercel'
  const commands = PLATFORM_COMMANDS[target]
  const envVars = data.envVars || []
  const allEnvSet = envVars.every(v => v.isSet)
  const preflightDone = Object.values(checked).filter(Boolean).length === PREFLIGHT_ITEMS.length

  function toggleCheck(item: string) {
    setChecked(prev => ({ ...prev, [item]: !prev[item] }))
  }

  function handleAddEnvVar() {
    if (!newKey.trim()) return
    addEnvVar(id, newKey.trim())
    setNewKey('')
  }

  function copyCommand(cmd: string) {
    navigator.clipboard.writeText(cmd)
  }

  const deploySystemContext = [
    `You are a deployment expert.`,
    `Help deploy this project to ${target}.`,
    project?.stack ? `Stack: ${project.stack}.` : '',
    `Be concise and give exact commands.`,
  ].filter(Boolean).join(' ')

  return (
    <div className={`${styles.node} ${data.status === 'done' ? styles.done : ''}`}>
      <Handle type="target" position={Position.Left} className={styles.handle} />

      <NodeHeader id={id} data={data} />

      {data.deployUrl && (
        <a
          href={data.deployUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.liveUrl}
        >
          {data.deployUrl}
        </a>
      )}

      <div className={styles.tabs}>
        {(['checklist', 'env', 'commands', 'chat'] as const).map(t => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'checklist' ? 'Preflight' : t === 'env' ? 'Env Vars' : t === 'commands' ? 'Commands' : 'Chat'}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>
        {tab === 'checklist' && (
          <div className={styles.checklist}>
            {PREFLIGHT_ITEMS.map(item => (
              <label key={item} className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={!!checked[item]}
                  onChange={() => toggleCheck(item)}
                  className={styles.checkbox}
                />
                <span className={checked[item] ? styles.checkedText : ''}>{item}</span>
              </label>
            ))}
            <div className={styles.preflightStatus}>
              {preflightDone && allEnvSet ? (
                <button
                  className={styles.deployBtn}
                  onClick={() => updateNodeStatus(id, 'done')}
                >
                  Ready to Deploy
                </button>
              ) : (
                <span className={styles.preflightHint}>
                  {!preflightDone ? `${PREFLIGHT_ITEMS.length - Object.values(checked).filter(Boolean).length} items remaining` : ''}
                  {!allEnvSet ? ' · Some env vars missing' : ''}
                </span>
              )}
            </div>
          </div>
        )}

        {tab === 'env' && (
          <div className={styles.envPanel}>
            {envVars.map(v => (
              <div key={v.key} className={styles.envRow}>
                <span className={`${styles.envDot} ${v.isSet ? styles.envDotSet : styles.envDotMissing}`} />
                <span className={styles.envKey}>{v.key}</span>
                <input
                  className={styles.envValue}
                  type="password"
                  placeholder="value..."
                  value={v.value}
                  onChange={e => updateEnvVar(id, v.key, e.target.value)}
                />
              </div>
            ))}
            <div className={styles.addEnv}>
              <input
                className={styles.newKeyInput}
                placeholder="NEW_KEY"
                value={newKey}
                onChange={e => setNewKey(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleAddEnvVar()}
              />
              <button className={styles.addBtn} onClick={handleAddEnvVar}>+ Add</button>
            </div>
          </div>
        )}

        {tab === 'commands' && (
          <div className={styles.commands}>
            <p className={styles.commandsHint}>Run these in your terminal to deploy to <strong>{target}</strong>:</p>
            {commands.map(cmd => (
              <div key={cmd} className={styles.commandRow}>
                <code className={styles.command}>{cmd}</code>
                <button className={styles.copyBtn} onClick={() => copyCommand(cmd)}>copy</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'chat' && (
          <ChatPane nodeId={id} data={data} systemContext={deploySystemContext} />
        )}
      </div>

      <Handle type="source" position={Position.Right} className={styles.handle} />
    </div>
  )
}
