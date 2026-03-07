'use client'

import { useSettings } from '@/contexts/settings-context'

export function useFormat() {
  const { settings } = useSettings()

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

  return {
    formatCurrency,
    formatCurrencyDetailed,
    formatNumber,
    formatDate,
    formatPercentage,
  }
}

function getLocale(numberFormat: 'US' | 'EU' | 'UK'): string {
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
