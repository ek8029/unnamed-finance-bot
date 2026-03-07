'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

// ============================================================================
// TYPES
// ============================================================================

export type Theme = 'light' | 'dark' | 'auto'
export type Density = 'compact' | 'comfortable' | 'spacious'
export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD'
export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'
export type NumberFormat = 'US' | 'EU' | 'UK'

export interface NotificationPreferences {
  marketAlerts: boolean
  transactionAlerts: boolean
  budgetAlerts: boolean
  taxReminders: boolean
  weeklyDigest: boolean
  monthlyReport: boolean
  email: boolean
  push: boolean
}

export interface AccessibilityPreferences {
  reduceMotion: boolean
  highContrast: boolean
  largeText: boolean
  screenReaderOptimized: boolean
}

export interface DashboardPreferences {
  defaultTab: 'overview' | 'accounts' | 'portfolio' | 'taxes'
  compactCharts: boolean
  showInsights: boolean
  autoRefresh: boolean
  refreshInterval: number // minutes
}

export interface Settings {
  // Appearance
  theme: Theme
  density: Density

  // Localization
  currency: Currency
  dateFormat: DateFormat
  numberFormat: NumberFormat

  // Notifications
  notifications: NotificationPreferences

  // Accessibility
  accessibility: AccessibilityPreferences

  // Dashboard
  dashboard: DashboardPreferences

  // Privacy
  analyticsEnabled: boolean
  crashReportingEnabled: boolean
}

interface SettingsContextType {
  settings: Settings
  updateSettings: (updates: Partial<Settings>) => void
  resetSettings: () => void
  isLoading: boolean
}

// ============================================================================
// DEFAULT SETTINGS
// ============================================================================

const DEFAULT_SETTINGS: Settings = {
  // Appearance
  theme: 'dark',
  density: 'comfortable',

  // Localization
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  numberFormat: 'US',

  // Notifications
  notifications: {
    marketAlerts: true,
    transactionAlerts: true,
    budgetAlerts: true,
    taxReminders: true,
    weeklyDigest: true,
    monthlyReport: false,
    email: true,
    push: false,
  },

  // Accessibility
  accessibility: {
    reduceMotion: false,
    highContrast: false,
    largeText: false,
    screenReaderOptimized: false,
  },

  // Dashboard
  dashboard: {
    defaultTab: 'overview',
    compactCharts: false,
    showInsights: true,
    autoRefresh: false,
    refreshInterval: 5,
  },

  // Privacy
  analyticsEnabled: true,
  crashReportingEnabled: true,
}

// ============================================================================
// CONTEXT
// ============================================================================

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

const STORAGE_KEY = 'helm-settings'

// ============================================================================
// PROVIDER
// ============================================================================

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Merge with defaults to handle new settings added in updates
        setSettings({ ...DEFAULT_SETTINGS, ...parsed })
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      } catch (error) {
        console.error('Failed to save settings:', error)
      }
    }
  }, [settings, isLoading])

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement

    // Determine effective theme
    let effectiveTheme = settings.theme
    if (effectiveTheme === 'auto') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }

    // Apply theme class
    root.classList.remove('light', 'dark')
    root.classList.add(effectiveTheme)

    // Set data attribute for CSS targeting
    root.setAttribute('data-theme', effectiveTheme)
  }, [settings.theme])

  // Apply density to document
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-density', settings.density)
  }, [settings.density])

  // Apply accessibility preferences
  useEffect(() => {
    const root = document.documentElement

    if (settings.accessibility.reduceMotion) {
      root.classList.add('reduce-motion')
    } else {
      root.classList.remove('reduce-motion')
    }

    if (settings.accessibility.highContrast) {
      root.classList.add('high-contrast')
    } else {
      root.classList.remove('high-contrast')
    }

    if (settings.accessibility.largeText) {
      root.classList.add('large-text')
    } else {
      root.classList.remove('large-text')
    }
  }, [settings.accessibility])

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (settings.theme !== 'auto') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = () => {
      const root = document.documentElement
      const effectiveTheme = mediaQuery.matches ? 'dark' : 'light'
      root.classList.remove('light', 'dark')
      root.classList.add(effectiveTheme)
      root.setAttribute('data-theme', effectiveTheme)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [settings.theme])

  const updateSettings = (updates: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...updates }))
  }

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS)
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  )
}

// ============================================================================
// HOOK
// ============================================================================

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
