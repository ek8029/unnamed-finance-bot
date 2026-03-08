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
  modulesOrder?: DashboardModuleId[]
  hiddenModules?: DashboardModuleId[]
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

export type DashboardModuleId = 'netWorth' | 'summary' | 'aiInsights'

interface SettingsContextType {
  settings: Settings
  updateSettings: (updates: Partial<Settings>) => void
  resetSettings: () => void
  isLoading: boolean
  // Formatting functions that respect localization settings
  formatCurrency: (amount: number) => string
  formatCurrencyDetailed: (amount: number) => string
  formatNumber: (value: number) => string
  formatDate: (date: Date | string) => string
  formatPercentage: (value: number, decimals?: number) => string
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
    modulesOrder: ['netWorth', 'summary', 'aiInsights'],
    hiddenModules: [],
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
        const parsed = JSON.parse(stored) as Partial<Settings>

        const merged: Settings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          notifications: {
            ...DEFAULT_SETTINGS.notifications,
            ...(parsed.notifications || {}),
          },
          accessibility: {
            ...DEFAULT_SETTINGS.accessibility,
            ...(parsed.accessibility || {}),
          },
          dashboard: {
            ...DEFAULT_SETTINGS.dashboard,
            ...(parsed.dashboard || {}),
          },
        }

        setSettings(merged)
      } else {
        setSettings(DEFAULT_SETTINGS)
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

    if (settings.accessibility.screenReaderOptimized) {
      root.classList.add('screen-reader-optimized')
    } else {
      root.classList.remove('screen-reader-optimized')
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

  // Formatting functions that respect localization settings
  const getLocale = (numberFormat: NumberFormat): string => {
    switch (numberFormat) {
      case 'US':
        return 'en-US'
      case 'EU':
        return 'de-DE'
      case 'UK':
        return 'en-GB'
      default:
        return 'en-US'
    }
  }

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat(getLocale(settings.numberFormat), {
      style: 'currency',
      currency: settings.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatCurrencyDetailed = (amount: number): string => {
    return new Intl.NumberFormat(getLocale(settings.numberFormat), {
      style: 'currency',
      currency: settings.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatNumber = (value: number): string => {
    return new Intl.NumberFormat(getLocale(settings.numberFormat)).format(value)
  }

  const formatDate = (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date

    switch (settings.dateFormat) {
      case 'MM/DD/YYYY':
        return new Intl.DateTimeFormat('en-US').format(dateObj)
      case 'DD/MM/YYYY':
        return new Intl.DateTimeFormat('en-GB').format(dateObj)
      case 'YYYY-MM-DD':
        return dateObj.toISOString().split('T')[0]
      default:
        return new Intl.DateTimeFormat('en-US').format(dateObj)
    }
  }

  const formatPercentage = (value: number, decimals: number = 1): string => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        resetSettings,
        isLoading,
        formatCurrency,
        formatCurrencyDetailed,
        formatNumber,
        formatDate,
        formatPercentage,
      }}
    >
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
