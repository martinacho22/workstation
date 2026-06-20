/**
 * chatSessionsStore
 *
 * Manages the open/minimised state of all FloatingChatCards independently
 * from the node store. Decoupled so multiple cards can be open simultaneously.
 *
 * Persisted via Zustand persist middleware — open chats survive app restart.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ChatSession {
  nodeId:    string
  minimised: boolean
  pos:       { x: number; y: number }
  order:     number
}

interface ChatSessionsState {
  sessions: Record<string, ChatSession>

  openChat:       (nodeId: string, order?: number) => void
  closeChat:      (nodeId: string) => void
  toggleMinimise: (nodeId: string) => void
  minimiseChat:   (nodeId: string) => void
  restoreChat:    (nodeId: string) => void
  updatePos:      (nodeId: string, pos: { x: number; y: number }) => void
  orderedSessions: () => ChatSession[]
}

function defaultPos(order: number) {
  const base = { x: window.innerWidth - 400, y: 90 }
  return {
    x: Math.max(20, base.x - order * 20),
    y: base.y + order * 28,
  }
}

export const useChatSessionsStore = create<ChatSessionsState>()(
  persist(
    (set, get) => ({
      sessions: {},

      openChat: (nodeId, order = 0) => {
        const existing = get().sessions[nodeId]
        if (existing) {
          set(s => ({
            sessions: {
              ...s.sessions,
              [nodeId]: { ...existing, minimised: false },
            },
          }))
        } else {
          set(s => ({
            sessions: {
              ...s.sessions,
              [nodeId]: {
                nodeId,
                minimised: false,
                pos:       defaultPos(order),
                order,
              },
            },
          }))
        }
      },

      closeChat: (nodeId) => {
        set(s => {
          const next = { ...s.sessions }
          delete next[nodeId]
          return { sessions: next }
        })
      },

      toggleMinimise: (nodeId) => {
        const s = get().sessions[nodeId]
        if (!s) return
        set(st => ({
          sessions: { ...st.sessions, [nodeId]: { ...s, minimised: !s.minimised } },
        }))
      },

      minimiseChat: (nodeId) => {
        const s = get().sessions[nodeId]
        if (!s) return
        set(st => ({
          sessions: { ...st.sessions, [nodeId]: { ...s, minimised: true } },
        }))
      },

      restoreChat: (nodeId) => {
        const s = get().sessions[nodeId]
        if (!s) return
        set(st => ({
          sessions: { ...st.sessions, [nodeId]: { ...s, minimised: false } },
        }))
      },

      updatePos: (nodeId, pos) => {
        const s = get().sessions[nodeId]
        if (!s) return
        set(st => ({
          sessions: { ...st.sessions, [nodeId]: { ...s, pos } },
        }))
      },

      orderedSessions: () =>
        Object.values(get().sessions).sort((a, b) => a.order - b.order),
    }),
    {
      name: 'workstation-chat-sessions-v1',
      // Only persist sessions — not the function helpers
      partialize: (state) => ({
        sessions: state.sessions,
      }),
    }
  )
)
