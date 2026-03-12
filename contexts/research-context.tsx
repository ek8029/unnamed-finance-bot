'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

// ── Types ──

export interface ResearchMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  analysis?: Record<string, unknown>
  timestamp: string // ISO string for serialization
}

interface ResearchContextValue {
  messages: ResearchMessage[]
  addMessage: (message: ResearchMessage) => void
  clearMessages: () => void
}

// ── Context ──

const ResearchContext = createContext<ResearchContextValue | undefined>(undefined)

const STORAGE_KEY = 'helm_research_history'

// ── Provider ──

export function ResearchProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ResearchMessage[]>([])
  const [hydrated, setHydrated] = useState(false)

  // Load from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setMessages(parsed)
        }
      }
    } catch {
      // sessionStorage unavailable or corrupt data
    }
    setHydrated(true)
  }, [])

  // Persist to sessionStorage on change (skip initial hydration)
  useEffect(() => {
    if (!hydrated) return
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch {
      // sessionStorage full or unavailable
    }
  }, [messages, hydrated])

  const addMessage = useCallback((message: ResearchMessage) => {
    setMessages(prev => [...prev, message])
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  return (
    <ResearchContext.Provider value={{ messages, addMessage, clearMessages }}>
      {children}
    </ResearchContext.Provider>
  )
}

// ── Hook ──

export function useResearch() {
  const context = useContext(ResearchContext)
  if (!context) {
    throw new Error('useResearch must be used within a ResearchProvider')
  }
  return context
}
