/**
 * ReliabilityBar
 *
 * Floating widget in the bottom-right corner showing the current reliability
 * review status. When files change, a Claude Code review is triggered and
 * this bar shows progress, score, and issues.
 *
 * Clicking the bar expands the issue panel for details.
 */

import { useState } from 'react'
import { useReliabilityStore, ReliabilityIssue } from '@/store/reliabilityStore'
import styles from './ReliabilityBar.module.css'

export default function ReliabilityBar() {
  const {
    status, progress, statusLabel,
    currentReview, lastReview, reviewHistory,
    isWatching, pendingChanges,
    dismissReview, clearHistory,
  } = useReliabilityStore()

  const [expanded, setExpanded] = useState(false)

  // Don't render if idle and no review history
  if (status === 'idle' && !lastReview && !isWatching) return null

  // Determine score class
  const score = currentReview?.score ?? lastReview?.score ?? 0
  const scoreClass = score >= 90 ? 'good' : score >= 70 ? 'ok' : 'bad'
  const issues = currentReview?.issues ?? []
  const criticalCount = issues.filter(i => i.severity === 'critical').length
  const warningCount = issues.filter(i => i.severity === 'warning').length

  function handleClick() {
    if (expanded) {
      setExpanded(false)
    } else if (currentReview || lastReview) {
      setExpanded(true)
    }
  }

  return (
    <div className={styles.container}>
      {/* Main bar */}
      <div className={styles.bar} onClick={handleClick} title={statusLabel}>
        <span className={`${styles.dot} ${styles[`dot_${status}`]}`} />

        <div className={styles.progressWrap}>
          <div
            className={`${styles.progressFill} ${styles[`progressFill_${status}`]}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {status === 'complete' && score > 0 && (
          <span className={`${styles.scoreBadge} ${styles[`score_${scoreClass}`]}`}>
            {score}%
          </span>
        )}

        {status === 'complete' && issues.length > 0 && (
          <span className={styles.issueCount}>
            {criticalCount > 0 ? `${criticalCount} critical` : `${issues.length} issues`}
          </span>
        )}

        <span className={`${styles.label} ${styles[`label_${status}`]}`}>
          {status === 'reviewing' && `${progress}%`}
          {status === 'complete' && (
            currentReview?.passed ? 'Passed' : 'Needs review'
          )}
          {status === 'error' && 'Failed'}
          {status === 'watching' && pendingChanges > 0 && `${pendingChanges} changes`}
          {status === 'watching' && pendingChanges === 0 && 'Watching'}
          {status === 'idle' && 'Idle'}
        </span>
      </div>

      {/* Expanded panel */}
      {expanded && (currentReview || lastReview) && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>
              Reliability Review
              {currentReview && ` — ${currentReview.score}%`}
            </span>
            <div className={styles.panelActions}>
              <button className={styles.panelBtn} onClick={dismissReview}>
                Dismiss
              </button>
              <button className={styles.panelBtn} onClick={() => { clearHistory(); setExpanded(false) }}>
                Clear
              </button>
              <button className={styles.panelBtn} onClick={() => setExpanded(false)}>
                Close
              </button>
            </div>
          </div>

          {/* Summary */}
          {(currentReview?.summary ?? lastReview?.summary) && (
            <div className={styles.summary}>
              {currentReview?.summary ?? lastReview?.summary}
            </div>
          )}

          {/* Issues */}
          {issues.length > 0 ? (
            <div className={styles.issueList}>
              {issues.map(issue => (
                <div key={issue.id} className={`${styles.issue} ${styles[`issue_${issue.severity}`]}`}>
                  <div className={styles.issueHeader}>
                    <span className={`${styles.issueSeverity} ${styles[`severity_${issue.severity}`]}`}>
                      {issue.severity}
                    </span>
                    <span className={styles.issueFile}>
                      {issue.file.replace(/^.*[\\/]/, '')}
                      {issue.line ? `:${issue.line}` : ''}
                    </span>
                  </div>
                  <div className={styles.issueDesc}>{issue.description}</div>
                  {issue.suggestion && (
                    <div className={styles.issueSuggestion}>
                      → {issue.suggestion}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyIssues}>
              {currentReview?.passed
                ? '✅ No issues found. Code looks clean!'
                : 'No issues to display.'}
            </div>
          )}

          {/* Footer */}
          <div className={styles.footer}>
            <span>
              {currentReview?.filesReviewed?.length ?? 0} files reviewed
            </span>
            <span>
              {reviewHistory.length} review{reviewHistory.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
