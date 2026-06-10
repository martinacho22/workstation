import styles from './Sidebar.module.css'
import { useWorkstationStore } from '@/store/useWorkstationStore'

type Screen = 'canvas' | 'dashboard' | 'warroom' | 'settings'

interface Props {
  screen: Screen
  onChange: (s: Screen) => void
}

const NAV_ITEMS: { id: Screen; icon: string; label: string }[] = [
  { id: 'canvas',    icon: '⬡', label: 'Canvas'    },
  { id: 'dashboard', icon: '⊞', label: 'Projects'  },
  { id: 'warroom',   icon: '⊛', label: 'War Room'  },
  { id: 'settings',  icon: '⚙', label: 'Settings'  },
]

export default function Sidebar({ screen, onChange }: Props) {
  const project = useWorkstationStore(s => s.project)

  function openProjectDir() {
    const dir = project?.projectDir ?? project?.repoPath
    if (!dir) return
    const electronAPI = (window as any).electron
    electronAPI?.fs?.openInFinder?.(dir)
  }

  const projectDir = project?.projectDir ?? project?.repoPath

  return (
    <div className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <span className={styles.logoIcon}>⬡</span>
        <span className={styles.logoText}>Workstation</span>
      </div>

      {/* Active project chip */}
      {project && (
        <div className={styles.projectChip}>
          <span className={styles.projectName}>{project.name}</span>
          {projectDir && (
            <button
              className={styles.projectDirBtn}
              onClick={openProjectDir}
              title={`Open in Finder: ${projectDir}`}
            >
              <span className={styles.projectDirText} title={projectDir}>
                {projectDir.replace(/^.*\/([^/]+)$/, '$1')}
              </span>
              <span className={styles.projectDirIcon}>↗</span>
            </button>
          )}
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

      {/* Bottom */}
      <div className={styles.bottom}>
        <span className={styles.version}>v0.1</span>
      </div>
    </div>
  )
}
