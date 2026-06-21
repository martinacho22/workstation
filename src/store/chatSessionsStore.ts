/**
 * chatSessionsStore
 *
 * Manages the open/minimised state of all FloatingChatCards independently
 * from the node store. Decoupled so multiple cards can be open simultaneously.
 *
 * activeNodeId in workstationStore is now ONLY used to track which node
 * was last interacted with (for context). It no longer controls chat visibility.
 *
 * PERSISTED: Session state survives app restarts — open chats are restored
 * when you reopen the project.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ChatSession {
  nodeId:    string
  minimised: boolean
  pos:       { x: number; y: number }
  order:     number   // roadmap order — lower = earlier in blueprint
}

interface ChatSessionsState {
  sessions: Record<string, ChatSession>

  // Open a chat for a node (or restore it if already open)
  openChat:     (nodeId: string, order?: number) => void
  // Close a chat entirely — removes from tray
  closeChat:    (nodeId: string) => void
  // Toggle minimised state
  toggleMinimise: (nodeId: string) => void
  // Minimise a chat
  minimiseChat: (nodeId: string) => void
  // Restore (un-minimise) a chat
  restoreChat:  (nodeId: string) => void
  // Update position after drag
  updatePos:    (nodeId: string, pos: { x: number; y: number }) => void
  // All open sessions sorted by roadmap order
  orderedSessions: () => ChatSession[]
}

// Stagger initial positions so cards don't stack exactly
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
          // Already open — just un-minimise
          set(s => ({
            sessions: {
              ...s.sessions,
              [nodeId]: { ...existing, minimised: false },
            },
          }))
        } else {
          // New session
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
      name: 'chat-sessions-store-v1',
      // Only persist session state — not the functions
      partialize: (state) => ({
        sessions: state.sessions,
      }),
    }
  )
)
