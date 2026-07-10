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
  dailyBrief: boolean
  weeklyUpdate: boolean
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
    dailyBrief: true,
    weeklyUpdate: true,
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

// Helper to transform API preferences to Settings format
function apiToSettings(prefs: Record<string, unknown>): Settings {
  return {
    theme: (prefs.theme as Settings['theme']) || DEFAULT_SETTINGS.theme,
    density: (prefs.density as Settings['density']) || DEFAULT_SETTINGS.density,
    currency: (prefs.currency as Settings['currency']) || DEFAULT_SETTINGS.currency,
    dateFormat: (prefs.date_format as Settings['dateFormat']) || DEFAULT_SETTINGS.dateFormat,
    numberFormat: (prefs.number_format as Settings['numberFormat']) || DEFAULT_SETTINGS.numberFormat,
    notifications: {
      dailyBrief: prefs.notification_daily_brief as boolean ?? DEFAULT_SETTINGS.notifications.dailyBrief,
      weeklyUpdate: prefs.notification_weekly_update as boolean ?? DEFAULT_SETTINGS.notifications.weeklyUpdate,
      marketAlerts: prefs.notification_market_alerts as boolean ?? DEFAULT_SETTINGS.notifications.marketAlerts,
      transactionAlerts: prefs.notification_transaction_alerts as boolean ?? DEFAULT_SETTINGS.notifications.transactionAlerts,
      budgetAlerts: prefs.notification_budget_alerts as boolean ?? DEFAULT_SETTINGS.notifications.budgetAlerts,
      taxReminders: prefs.notification_tax_reminders as boolean ?? DEFAULT_SETTINGS.notifications.taxReminders,
      weeklyDigest: prefs.notification_weekly_digest as boolean ?? DEFAULT_SETTINGS.notifications.weeklyDigest,
      monthlyReport: prefs.notification_monthly_report as boolean ?? DEFAULT_SETTINGS.notifications.monthlyReport,
      email: prefs.notification_email as boolean ?? DEFAULT_SETTINGS.notifications.email,
      push: prefs.notification_push as boolean ?? DEFAULT_SETTINGS.notifications.push,
    },
    accessibility: {
      reduceMotion: prefs.reduce_motion as boolean ?? DEFAULT_SETTINGS.accessibility.reduceMotion,
      highContrast: prefs.high_contrast as boolean ?? DEFAULT_SETTINGS.accessibility.highContrast,
      largeText: prefs.large_text as boolean ?? DEFAULT_SETTINGS.accessibility.largeText,
      screenReaderOptimized: prefs.screen_reader_optimized as boolean ?? DEFAULT_SETTINGS.accessibility.screenReaderOptimized,
    },
    dashboard: {
      defaultTab: (prefs.default_tab as Settings['dashboard']['defaultTab']) || DEFAULT_SETTINGS.dashboard.defaultTab,
      compactCharts: prefs.compact_charts as boolean ?? DEFAULT_SETTINGS.dashboard.compactCharts,
      showInsights: prefs.show_insights as boolean ?? DEFAULT_SETTINGS.dashboard.showInsights,
      autoRefresh: prefs.auto_refresh as boolean ?? DEFAULT_SETTINGS.dashboard.autoRefresh,
      refreshInterval: (prefs.refresh_interval as number) || DEFAULT_SETTINGS.dashboard.refreshInterval,
      modulesOrder: DEFAULT_SETTINGS.dashboard.modulesOrder,
      hiddenModules: DEFAULT_SETTINGS.dashboard.hiddenModules,
    },
    analyticsEnabled: prefs.analytics_enabled as boolean ?? DEFAULT_SETTINGS.analyticsEnabled,
    crashReportingEnabled: prefs.crash_reporting_enabled as boolean ?? DEFAULT_SETTINGS.crashReportingEnabled,
  }
}

// Helper to transform Settings to API format
function settingsToApi(settings: Settings): Record<string, unknown> {
  return {
    theme: settings.theme,
    density: settings.density,
    currency: settings.currency,
    date_format: settings.dateFormat,
    number_format: settings.numberFormat,
    notification_daily_brief: settings.notifications.dailyBrief,
    notification_weekly_update: settings.notifications.weeklyUpdate,
    notification_market_alerts: settings.notifications.marketAlerts,
    notification_transaction_alerts: settings.notifications.transactionAlerts,
    notification_budget_alerts: settings.notifications.budgetAlerts,
    notification_tax_reminders: settings.notifications.taxReminders,
    notification_weekly_digest: settings.notifications.weeklyDigest,
    notification_monthly_report: settings.notifications.monthlyReport,
    notification_email: settings.notifications.email,
    notification_push: settings.notifications.push,
    reduce_motion: settings.accessibility.reduceMotion,
    high_contrast: settings.accessibility.highContrast,
    large_text: settings.accessibility.largeText,
    screen_reader_optimized: settings.accessibility.screenReaderOptimized,
    default_tab: settings.dashboard.defaultTab,
    compact_charts: settings.dashboard.compactCharts,
    show_insights: settings.dashboard.showInsights,
    auto_refresh: settings.dashboard.autoRefresh,
    refresh_interval: settings.dashboard.refreshInterval,
    analytics_enabled: settings.analyticsEnabled,
    crash_reporting_enabled: settings.crashReportingEnabled,
  }
}

// ============================================================================
// PROVIDER
// ============================================================================

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Load settings from API (if authenticated) or localStorage on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        // Try to fetch from API first
        const res = await fetch('/api/user/preferences')
        if (res.ok) {
          const data = await res.json()
          if (data.preferences) {
            setSettings(apiToSettings(data.preferences))
            setIsAuthenticated(true)
            // Also update localStorage as fallback
            localStorage.setItem(STORAGE_KEY, JSON.stringify(apiToSettings(data.preferences)))
          }
        } else if (res.status === 401) {
          // Not authenticated, use localStorage
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
          }
        }
      } catch (error) {
        // Network error, fall back to localStorage
        console.error('Failed to fetch settings from API:', error)
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
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()
  }, [])

  // Persist settings to API (if authenticated) and localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      // Always save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      } catch (error) {
        console.error('Failed to save settings to localStorage:', error)
      }

      // If authenticated, also save to API
      if (isAuthenticated) {
        fetch('/api/user/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settingsToApi(settings)),
        }).catch((error) => {
          console.error('Failed to save settings to API:', error)
        })
      }
    }
  }, [settings, isLoading, isAuthenticated])

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
