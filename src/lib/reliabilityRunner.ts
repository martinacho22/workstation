/**
 * reliabilityRunner.ts
 *
 * Watches the project directory for file changes and triggers a background
 * Claude Code review of changed files. The review checks for:
 *   - Code quality and correctness
 *   - Potential bugs and edge cases
 *   - Security vulnerabilities
 *   - Performance issues
 *   - Best practices for the project stack
 *
 * Results feed into the reliabilityStore for UI display.
 */

import { useReliabilityStore, ReliabilityIssue, ReviewResult } from '@/store/reliabilityStore'
import { useWorkstationStore } from '@/store/useWorkstationStore'

const REVIEW_DEBOUNCE_MS = 3000
const MAX_CHANGES_PER_REVIEW = 20

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let watchCleanup: (() => void) | null = null

/**
 * Get the diff of files that have changed since the last review.
 * Uses git diff if available, otherwise lists recently modified files.
 */
async function getChangedFiles(dir: string): Promise<{ path: string; content: string }[]> {
  const electronAPI = (window as any).electron
  if (!electronAPI?.fs?.readDir || !electronAPI?.fs?.readFile) return []

  try {
    // Read the project directory to get all files
    const dirResult = await electronAPI.fs.readDir(dir)
    if (!dirResult.success) return []

    // Get all source files (filter out node_modules, .git, etc.)
    const sourceFiles = dirResult.files.filter((f: any) =>
      f.isFile &&
      !f.name.startsWith('.') &&
      !f.name.includes('node_modules') &&
      !f.name.includes('.git') &&
      /\.(ts|tsx|js|jsx|py|rs|go|rb|php|css|scss|html|vue|svelte|md|json|yaml|yml|toml)$/i.test(f.name)
    )

    // Get most recently modified files (up to MAX_CHANGES_PER_REVIEW)
    const recentFiles = sourceFiles
      .sort((a: any, b: any) => b.mtimeMs - a.mtimeMs)
      .slice(0, MAX_CHANGES_PER_REVIEW)

    const result: { path: string; content: string }[] = []
    for (const file of recentFiles) {
      try {
        const contentResult = await electronAPI.fs.readFile(file.path)
        if (contentResult.success) {
          result.push({ path: file.path, content: contentResult.content })
        }
      } catch {
        // Skip files that can't be read
      }
    }
    return result
  } catch {
    return []
  }
}

/**
 * Run a Claude review on the changed files.
 * Returns a structured review result.
 */
async function runReview(dir: string): Promise<ReviewResult> {
  const store = useReliabilityStore.getState()
  const project = useWorkstationStore.getState().project
  const startedAt = Date.now()

  store.updateProgress(5, 'Reading changed files…')

  // Get changed files
  const files = await getChangedFiles(dir)

  if (files.length === 0) {
    return {
      score: 100,
      issues: [],
      summary: 'No source files to review.',
      startedAt,
      completedAt: Date.now(),
      filesReviewed: [],
      passed: true,
    }
  }

  store.updateProgress(15, `Reviewing ${files.length} files…`)

  // Build the review prompt for Claude
  const fileContexts = files.map(f => {
    const relativePath = f.path.replace(dir, '').replace(/^\//, '')
    return `File: ${relativePath}\n\`\`\`\n${f.content.slice(0, 3000)}\n\`\`\``
  }).join('\n\n---\n\n')

  const projectName = project?.name ?? 'this project'
  const stack = project?.stack ?? 'the project'

  const prompt = `You are a senior code reviewer reviewing code that was just pushed to "${projectName}".

Stack: ${stack}

Review the following files for:
1. **Correctness** — any bugs, logic errors, or typos
2. **Security** — any vulnerabilities (XSS, injection, exposed secrets)
3. **Performance** — any obvious performance issues
4. **Best practices** — any violations of stack-specific best practices
5. **Edge cases** — any unhandled error states or edge cases

${fileContexts}

Return a JSON object (no markdown, no explanation):
{
  "score": <0-100 reliability score>,
  "issues": [
    {
      "severity": "critical" | "warning" | "info",
      "file": "<filename>",
      "line": <optional line number>,
      "description": "<what's wrong>",
      "suggestion": "<how to fix it>"
    }
  ],
  "summary": "<2-3 sentence overview of review findings>"
}

Scoring guide:
- 90-100: Clean code, no issues found
- 70-89: Minor issues, safe to ship but should fix
- 50-69: Several issues, should fix before shipping
- <50: Critical issues found, must fix before shipping`

  store.updateProgress(30, 'Claude is analyzing code quality…')

  // Run Claude CLI in the background
  const electronAPI = (window as any).electron
  if (!electronAPI?.claude?.run) {
    throw new Error('Claude CLI not available')
  }

  // Simulate progress as Claude works (we don't get streaming from runClaude in background)
  let progressInterval: ReturnType<typeof setInterval> | null = null
  const progressSteps = [
    { at: 35, label: 'Checking correctness…' },
    { at: 50, label: 'Checking security…' },
    { at: 65, label: 'Checking performance…' },
    { at: 80, label: 'Checking best practices…' },
  ]
  let stepIndex = 0
  progressInterval = setInterval(() => {
    if (stepIndex < progressSteps.length) {
      const step = progressSteps[stepIndex]
      store.updateProgress(step.at, step.label)
      stepIndex++
    } else {
      store.updateProgress(90, 'Finalizing review…')
      if (progressInterval) clearInterval(progressInterval)
    }
  }, 2000)

  try {
    const result = await electronAPI.claude.run(prompt, {
      skipPermissions: true,
      timeout: 120000,
    })

    if (progressInterval) clearInterval(progressInterval)

    if (!result.success) {
      throw new Error(result.error || 'Claude review failed')
    }

    store.updateProgress(95, 'Parsing review results…')

    // Parse the JSON from Claude's response
    const text = result.result
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not parse review results')
    }

    const parsed = JSON.parse(jsonMatch[0])

    const filesReviewed = files.map(f => f.path.replace(dir, '').replace(/^\//, ''))
    const score = typeof parsed.score === 'number' ? parsed.score : 100
    const issues: ReliabilityIssue[] = (parsed.issues || []).map((i: any) => ({
      id: `rel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      severity: i.severity || 'info',
      file: i.file || 'unknown',
      line: i.line,
      description: i.description || 'No description',
      suggestion: i.suggestion,
    }))
    const summary = parsed.summary || 'Review complete.'

    return {
      score,
      issues,
      summary,
      startedAt,
      completedAt: Date.now(),
      filesReviewed,
      passed: score >= 70,
    }
  } catch (err) {
    if (progressInterval) clearInterval(progressInterval)
    throw err
  }
}

/**
 * Called when a file change is detected.
 * Debounces so rapid changes only trigger one review.
 */
export function onFileChange(dir: string) {
  const store = useReliabilityStore.getState()

  store.notifyFileChange()

  if (debounceTimer) clearTimeout(debounceTimer)

  debounceTimer = setTimeout(async () => {
    const s = useReliabilityStore.getState()
    if (s.status === 'reviewing') {
      // A review is already running — queue another after this one
      // by setting a new debounce
      return
    }

    s.startReview()

    try {
      const result = await runReview(dir)
      useReliabilityStore.getState().completeReview(result)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      useReliabilityStore.getState().failReview(errorMsg)
    }
  }, REVIEW_DEBOUNCE_MS)
}

/**
 * Start watching a directory for file changes.
 * Returns cleanup function.
 */
export function startReliabilityWatcher(dir: string): () => void {
  const store = useReliabilityStore.getState()

  // Clean up any existing watcher
  if (watchCleanup) {
    watchCleanup()
    watchCleanup = null
  }

  const electronAPI = (window as any).electron
  if (!electronAPI?.fs?.watchDir) {
    store.failReview('File watching not available')
    return () => {}
  }

  store.startWatching()

  // Start watching
  electronAPI.fs.watchDir(dir, (change: { eventType: string; filename: string; fullPath: string }) => {
    // Ignore .git directory and node_modules
    if (change.filename?.includes('.git') || change.filename?.includes('node_modules')) return
    // Ignore .workstation meta file
    if (change.filename?.endsWith('.workstation')) return

    onFileChange(dir)
  })

  store.setWatcherId(dir)

  watchCleanup = () => {
    // No clean way to unwatch without the watcherId from the callback
    // The watcher is process-scoped so it'll be garbage collected
    store.stopWatching()
  }

  return watchCleanup
}

/**
 * Stop the reliability watcher.
 */
export function stopReliabilityWatcher() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (watchCleanup) {
    watchCleanup()
    watchCleanup = null
  }
}
