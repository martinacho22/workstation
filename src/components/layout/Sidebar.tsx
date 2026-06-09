import { Screen } from '@/types/screens'
import styles from './Sidebar.module.css'

interface Props {
  current: Screen
  onChange: (s: Screen) => void
  collapsed: boolean
}

// Clean geometric symbols — no emojis
const NAV: { id: Screen; icon: string; label: string }[] = [
  { id: 'dashboard', icon: '▦',  label: 'Dashboard' },
  { id: 'canvas',    icon: '◻',  label: 'Canvas'    },
  { id: 'warroom',   icon: '◈',  label: 'War Room'  },
  { id: 'projects',  icon: '▤',  label: 'Projects'  },
]

const BOTTOM: { id: Screen; icon: string; label: string }[] = [
  { id: 'settings', icon: '⊙', label: 'Settings' },
]

export default function Sidebar({ current, onChange, collapsed }: Props) {
  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      {/* Logo */}
      <div className={styles.logo}>
        {collapsed
          ? <span className={styles.logoIcon}>W</span>
          : <><span className={styles.logoIcon}>W</span><span className={styles.logoText}>Workstation</span></>
        }
      </div>

      <nav className={styles.nav}>
        {NAV.map(item => (
          <button
            key={item.id}
            className={`${styles.navItem} ${current === item.id ? styles.active : ''}`}
            onClick={() => onChange(item.id)}
            title={collapsed ? item.label : undefined}
          >
            <span className={styles.icon}>{item.icon}</span>
            {!collapsed && <span className={styles.label}>{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className={styles.bottom}>
        {BOTTOM.map(item => (
          <button
            key={item.id}
            className={`${styles.navItem} ${current === item.id ? styles.active : ''}`}
            onClick={() => onChange(item.id)}
            title={collapsed ? item.label : undefined}
          >
            <span className={styles.icon}>{item.icon}</span>
            {!collapsed && <span className={styles.label}>{item.label}</span>}
          </button>
        ))}
      </div>
    </aside>
  )
}
