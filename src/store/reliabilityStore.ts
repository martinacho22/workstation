/**
 * reliabilityStore
 *
 * Tracks the state of automatic Claude Code reliability reviews.
 * When files change in the project directory, a background Claude review
 * is triggered. The progress, score, and issues are tracked here.
 */

import { create } from 'zustand'

export interface ReliabilityIssue {
  id: string
  severity: 'critical' | 'warning' | 'info'
  file: string
  line?: number
  description: string
  suggestion?: string
}

export interface ReviewResult {
  score: number          // 0-100 reliability score
  issues: ReliabilityIssue[]
  summary: string
  startedAt: number
  completedAt: number
  filesReviewed: string[]
  passed: boolean        // score >= threshold (70)
}

export type ReviewStatus = 'idle' | 'watching' | 'reviewing' | 'complete' | 'error'

interface ReliabilityState {
  // Review lifecycle
  status: ReviewStatus
  progress: number        // 0-100
  statusLabel: string     // human-readable status message

  // Latest review
  currentReview: ReviewResult | null
  lastReview: ReviewResult | null

  // History
  reviewHistory: ReviewResult[]

  // Watcher state
  watcherId: string | null
  isWatching: boolean

  // Pending changes (debounced)
  pendingChanges: number
  lastChangeAt: number | null

  // Actions
  startWatching: () => void
  stopWatching: () => void
  setWatcherId: (id: string | null) => void

  notifyFileChange: () => void
  startReview: () => void
  updateProgress: (progress: number, label: string) => void
  completeReview: (result: ReviewResult) => void
  failReview: (error: string) => void
  dismissReview: () => void
  clearHistory: () => void
}

const REVIEW_DEBOUNCE_MS = 3000  // Wait 3s after last change before reviewing

export const useReliabilityStore = create<ReliabilityState>((set, get) => ({
  status: 'idle',
  progress: 0,
  statusLabel: 'Ready',
  currentReview: null,
  lastReview: null,
  reviewHistory: [],
  watcherId: null,
  isWatching: false,
  pendingChanges: 0,
  lastChangeAt: null,

  startWatching: () => set({ isWatching: true, status: 'watching', statusLabel: 'Watching for changes…' }),

  stopWatching: () => set({
    isWatching: false,
    status: 'idle',
    statusLabel: 'Stopped',
    watcherId: null,
    pendingChanges: 0,
  }),

  setWatcherId: (id) => set({ watcherId: id }),

  notifyFileChange: () => {
    const state = get()
    const newCount = state.pendingChanges + 1
    set({
      pendingChanges: newCount,
      lastChangeAt: Date.now(),
      status: 'watching',
      statusLabel: `Changes detected (${newCount}) — reviewing soon…`,
    })
  },

  startReview: () => set({
    status: 'reviewing',
    progress: 0,
    statusLabel: 'Claude is reviewing…',
    currentReview: null,
  }),

  updateProgress: (progress, label) => set({
    progress: Math.min(100, Math.max(0, progress)),
    statusLabel: label,
  }),

  completeReview: (result) => {
    const state = get()
    set({
      status: 'complete',
      progress: 100,
      statusLabel: result.passed ? `Reliability: ${result.score}% ✅` : `Reliability: ${result.score}% — ${result.issues.length} issues`,
      currentReview: result,
      lastReview: result,
      reviewHistory: [...state.reviewHistory.slice(-49), result],
      pendingChanges: 0,
    })
  },

  failReview: (error) => set({
    status: 'error',
    statusLabel: `Review failed: ${error}`,
    pendingChanges: 0,
  }),

  dismissReview: () => set({
    status: 'watching',
    statusLabel: 'Watching for changes…',
    currentReview: null,
    progress: 0,
  }),

  clearHistory: () => set({ reviewHistory: [] }),
}))
