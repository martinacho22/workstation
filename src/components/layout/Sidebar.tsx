import styles from './Sidebar.module.css'
import { useWorkstationStore } from '@/store/useWorkstationStore'

type Screen = 'canvas' | 'dashboard' | 'warroom' | 'settings'

interface Props {
  screen: Screen
  onChange: (s: Screen) => void
}

const NAV_ITEMS: { id: Screen; icon: string; label: string }[] = [
  { id: 'canvas',    icon: 'CVS', label: 'Canvas'    },
  { id: 'dashboard', icon: 'PRJ', label: 'Projects'  },
  { id: 'warroom',   icon: 'WAR', label: 'War Room'  },
  { id: 'settings',  icon: 'SET', label: 'Settings'  },
]

export default function Sidebar({ screen, onChange }: Props) {
  const project = useWorkstationStore(s => s.project)

  return (
    <div className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <span className={styles.logoIcon}>⬡</span>
        <span className={styles.logoText}>Workstation</span>
      </div>

      {/* Project name chip */}
      {project && (
        <div style={{
          margin: '8px 12px 0',
          padding: '6px 10px',
          borderRadius: 6,
          background: 'rgba(0,255,136,0.06)',
          border: '1px solid rgba(0,255,136,0.12)',
          fontSize: 11,
          color: 'var(--accent, #00ff88)',
          fontWeight: 600,
          letterSpacing: '0.03em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {project.name}
        </div>
      )}

      {/* Main nav */}
      <nav className={styles.nav}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`${styles.navItem} ${screen === item.id ? styles.active : ''}`}
            onClick={() => onChange(item.id)}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Bottom — version */}
      <div className={styles.bottom}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.04em' }}>
          WORKSTATION v0.1
        </span>
      </div>
    </div>
  )
}
