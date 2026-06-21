import { useState, useEffect, useCallback } from 'react'
import { useWorkstationStore } from '@/store/useWorkstationStore'
import styles from './FileTreePanel.module.css'

interface FileEntry {
  name: string
  path: string
  isDir: boolean
  children?: FileEntry[]
}

interface FileTreeProps {
  onClose?: () => void
}

/**
 * FileTreePanel — shows the project's file tree, grouped by type.
 *
 * Reads the project directory via Electron IPC (fs.readDirectory).
 * Falls back gracefully in browser dev mode.
 */
export default function FileTreePanel({ onClose }: FileTreeProps) {
  const project = useWorkstationStore(s => s.project)
  const projectDir = project?.projectDir ?? project?.repoPath

  const [tree, setTree] = useState<FileEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const readDir = useCallback(async (dirPath: string): Promise<FileEntry[]> => {
    const electronAPI = (window as any).electron
    if (!electronAPI?.fs?.readDirectory) {
      // Fallback: show the project directory name only
      return [{ name: dirPath.split('/').pop() || dirPath, path: dirPath, isDir: true }]
    }
    return electronAPI.fs.readDirectory(dirPath)
  }, [])

  useEffect(() => {
    if (!projectDir) {
      setTree(null)
      return
    }

    setLoading(true)
    setError(null)

    // Try to read directory tree via Electron IPC
    const electronAPI = (window as any).electron

    if (electronAPI?.fs?.readDirectory) {
      readDir(projectDir)
        .then(entries => {
          setTree(buildFileTree(entries, projectDir))
          // Auto-expand top-level
          setExpanded(new Set(entries.filter(e => e.isDir).map(e => e.path)))
          setLoading(false)
        })
        .catch(err => {
          setError(err.message)
          setLoading(false)
        })
    } else {
      // Browser fallback — show project path
      setTree([
        { name: projectDir.split('/').pop() || projectDir, path: projectDir, isDir: true }
      ])
      setLoading(false)
    }
  }, [projectDir, readDir])

  function buildFileTree(entries: FileEntry[], basePath: string): FileEntry[] {
    // If entries returned from IPC are flat, we need to group by type
    // For now, show the raw tree structure
    return entries
  }

  function toggleExpand(path: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function openFile(path: string) {
    const electronAPI = (window as any).electron
    if (electronAPI?.fs?.openInEditor) {
      electronAPI.fs.openInEditor(path)
    } else if (electronAPI?.fs?.openInFinder) {
      electronAPI.fs.openInFinder(path)
    }
  }

  function getFileIcon(entry: FileEntry): string {
    if (entry.isDir) return '▸'
    const ext = entry.name.split('.').pop()?.toLowerCase()
    if (['ts', 'tsx'].includes(ext || '')) return 'Θ'
    if (['js', 'jsx'].includes(ext || '')) return '◇'
    if (['css', 'scss', 'less'].includes(ext || '')) return '#'
    if (['json', 'yaml', 'yml', 'toml'].includes(ext || '')) return '{ }'
    if (['md', 'mdx'].includes(ext || '')) return 'M'
    if (['py'].includes(ext || '')) return '▶'
    if (['go'].includes(ext || '')) return 'G'
    if (['rs'].includes(ext || '')) return 'R'
    if (['html', 'svelte', 'vue'].includes(ext || '')) return '<>'
    return '·'
  }

  if (!project) return null

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>⊞</span>
        <span className={styles.headerTitle}>Files</span>
        {onClose && (
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        )}
      </div>

      <div className={styles.treeContainer}>
        {loading && (
          <div className={styles.loading}>
            <span className={styles.loadingDot} />
            Loading files…
          </div>
        )}

        {error && (
          <div className={styles.error}>
            <span className={styles.errorIcon}>⚠</span>
            {error}
          </div>
        )}

        {!projectDir && !loading && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>⊞</div>
            <div className={styles.emptyText}>No project directory</div>
            <div className={styles.emptyHint}>Set a project path in Settings to see files</div>
          </div>
        )}

        {tree && !loading && !error && (
          <div className={styles.tree}>
            {tree.map(entry => (
              <FileTreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                expanded={expanded}
                onToggle={toggleExpand}
                onOpen={openFile}
                getIcon={getFileIcon}
              />
            ))}
          </div>
        )}

        {/* Debug: show path when no file tree but project dir exists */}
        {projectDir && !tree && !loading && !error && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>⊞</div>
            <div className={styles.emptyText}>{projectDir}</div>
            <div className={styles.emptyHint}>
              Files will appear when connected to Electron
            </div>
          </div>
        )}
      </div>

      {/* Bottom — quick actions */}
      <div className={styles.bottom}>
        <button
          className={styles.actionBtn}
          onClick={() => {
            const electronAPI = (window as any).electron
            if (projectDir && electronAPI?.fs?.openInFinder) {
              electronAPI.fs.openInFinder(projectDir)
            }
          }}
          title="Open in Finder"
        >
          ⌘ Open in Finder
        </button>
      </div>
    </div>
  )
}

// ─── FileTreeNode (recursive) ────────────────────────────────────────────────

interface FileTreeNodeProps {
  entry: FileEntry
  depth: number
  expanded: Set<string>
  onToggle: (path: string) => void
  onOpen: (path: string) => void
  getIcon: (entry: FileEntry) => string
}

function FileTreeNode({ entry, depth, expanded, onToggle, onOpen, getIcon }: FileTreeNodeProps) {
  const isExpanded = expanded.has(entry.path)

  function handleClick() {
    if (entry.isDir) {
      onToggle(entry.path)
    } else {
      onOpen(entry.path)
    }
  }

  return (
    <div className={styles.treeItemWrapper}>
      <div
        className={styles.treeItem}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={handleClick}
        title={entry.path}
      >
        {entry.isDir ? (
          <span className={`${styles.dirArrow} ${isExpanded ? styles.dirArrowExpanded : ''}`}>▸</span>
        ) : (
          <span className={styles.fileIcon}>{getIcon(entry)}</span>
        )}
        <span className={entry.isDir ? styles.dirName : styles.fileName}>
          {entry.name}
        </span>
      </div>

      {entry.isDir && isExpanded && entry.children && (
        <div className={styles.children}>
          {entry.children.map(child => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onOpen={onOpen}
              getIcon={getIcon}
            />
          ))}
        </div>
      )}
    </div>
  )
}
