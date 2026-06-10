import { Screen } from '@/types/screens'
import styles from './Sidebar.module.css'

interface Props {
  current: Screen
  onChange: (s: Screen) => void
  collapsed: boolean
}

const NAV: { id: Screen; icon: string; label: string }[] = [
  { id: 'dashboard', icon: 'DB', label: 'Dashboard' },
  { id: 'canvas',    icon: 'CV', label: 'Canvas'    },
  { id: 'warroom',   icon: 'WR', label: 'War Room'  },
]

const BOTTOM: { id: Screen; icon: string; label: string }[] = [
  { id: 'settings', icon: 'ST', label: 'Settings' },
]

export default function Sidebar({ current, onChange, collapsed }: Props) {
  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
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
            title={item.label}
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
            title={item.label}
          >
            <span className={styles.icon}>{item.icon}</span>
            {!collapsed && <span className={styles.label}>{item.label}</span>}
          </button>
        ))}
      </div>
    </aside>
  )
}
