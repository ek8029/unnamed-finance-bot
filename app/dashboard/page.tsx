'use client'

import { useMemo } from 'react'
import { GripVertical, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react'
import { NetWorthCard } from '@/components/dashboard/net-worth-card';
import { FinancialSummaryCards } from '@/components/dashboard/financial-summary-cards';
import { FinancialHealthScore } from '@/components/dashboard/financial-health-score';
import { AIInsightsFeed } from '@/components/dashboard/ai-insights-feed';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  mockFinancialSummary,
  mockFinancialHealthScore,
  mockNetWorthHistory,
  mockInsights,
} from '@/lib/mock-data';
import { useSettings, DashboardModuleId } from '@/contexts/settings-context'

const ALL_MODULES: DashboardModuleId[] = ['netWorth', 'summary', 'aiInsights']

export default function DashboardOverview() {
  const { settings, updateSettings } = useSettings()

  const modulesOrder = settings.dashboard.modulesOrder && settings.dashboard.modulesOrder.length > 0
    ? settings.dashboard.modulesOrder
    : ALL_MODULES

  const hiddenModules = settings.dashboard.hiddenModules || []

  const orderedVisibleModules: DashboardModuleId[] = useMemo(
    () => modulesOrder.filter((id) => !hiddenModules.includes(id)),
    [modulesOrder, hiddenModules]
  )

  const updateDashboardPrefs = (nextOrder: DashboardModuleId[], nextHidden: DashboardModuleId[]) => {
    updateSettings({
      dashboard: {
        ...settings.dashboard,
        modulesOrder: nextOrder,
        hiddenModules: nextHidden,
      },
    })
  }

  const moveModule = (id: DashboardModuleId, direction: 'up' | 'down') => {
    const current = modulesOrder
    const index = current.indexOf(id)
    if (index === -1) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= current.length) return

    const next = [...current]
    const [removed] = next.splice(index, 1)
    next.splice(targetIndex, 0, removed)
    updateDashboardPrefs(next, hiddenModules)
  }

  const toggleHidden = (id: DashboardModuleId) => {
    const isHidden = hiddenModules.includes(id)
    const nextHidden = isHidden
      ? hiddenModules.filter((m) => m !== id)
      : [...hiddenModules, id]
    updateDashboardPrefs(modulesOrder, nextHidden)
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="type-h1">Overview</h1>
        <p className="type-body">
          Your complete financial picture and AI-powered insights
        </p>
      </div>

      {/* Main modules, ordered and toggleable */}
      {orderedVisibleModules.map((moduleId) => {
        switch (moduleId) {
          case 'netWorth':
            return (
              <NetWorthCard
                key="netWorth"
                currentNetWorth={mockFinancialSummary.net_worth}
                netWorthHistory={mockNetWorthHistory}
              />
            )
          case 'summary':
            return (
              <FinancialSummaryCards
                key="summary"
                totalAssets={mockFinancialSummary.total_assets}
                totalLiabilities={mockFinancialSummary.total_liabilities}
                monthlyCashFlow={mockFinancialSummary.monthly_cash_flow}
                portfolioValue={mockFinancialSummary.portfolio_value}
              />
            )
          case 'aiInsights':
            return (
              <div
                key="aiInsights"
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
                <div className="lg:col-span-2">
                  <AIInsightsFeed insights={mockInsights} />
                </div>
                <div>
                  <FinancialHealthScore healthScore={mockFinancialHealthScore} />
                </div>
              </div>
            )
          default:
            return null
        }
      })}

      {/* Layout customization */}
      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="type-h3">Customize overview layout</CardTitle>
            <CardDescription>
              Reorder or hide modules. Preferences are stored locally on this device.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {ALL_MODULES.map((id) => {
            const isHidden = hiddenModules.includes(id)
            const index = modulesOrder.indexOf(id)
            const isFirst = index === 0
            const isLast = index === modulesOrder.length - 1

            const label =
              id === 'netWorth'
                ? 'Net Worth'
                : id === 'summary'
                ? 'Financial Summary'
                : 'AI Insights & Health'

            return (
              <div
                key={id}
                className="flex items-center justify-between rounded-md border border-helm-border-subtle bg-helm-elevated px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-helm-muted" />
                  <div>
                    <div className="type-label text-helm-platinum">{label}</div>
                    <div className="type-caption text-helm-secondary">
                      {isHidden ? 'Hidden' : `Position ${index + 1}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={isFirst}
                      onClick={() => moveModule(id, 'up')}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={isLast}
                      onClick={() => moveModule(id, 'down')}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => toggleHidden(id)}
                    aria-label={isHidden ? 'Show module' : 'Hide module'}
                  >
                    {isHidden ? (
                      <Eye className="h-4 w-4 text-helm-secondary" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-helm-secondary" />
                    )}
                  </Button>
                  <div className="flex items-center gap-1">
                    <Switch checked={!isHidden} onCheckedChange={() => toggleHidden(id)} />
                  </div>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  );
}
