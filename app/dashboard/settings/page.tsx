'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useSettings } from '@/contexts/settings-context'
import { useToast } from '@/contexts/toast-context'
import {
  User,
  Bell,
  Shield,
  Palette,
  CreditCard,
  Database,
  Lock,
  Smartphone,
  Globe,
  Monitor,
  DollarSign,
  Calendar,
  Eye,
  Accessibility,
} from 'lucide-react'

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings, formatCurrency, formatCurrencyDetailed, formatDate } = useSettings()
  const { success, info } = useToast()

  // Profile state
  const [profile, setProfile] = useState({
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
  })

  const handleSaveProfile = () => {
    success('Profile updated', 'Your changes have been saved successfully')
  }

  const handleThemeChange = (theme: 'light' | 'dark' | 'auto') => {
    updateSettings({ theme })
    info('Theme changed', `Switched to ${theme} mode`)
  }

  const handleDensityChange = (density: 'compact' | 'comfortable' | 'spacious') => {
    updateSettings({ density })
    info('Density changed', `Switched to ${density} layout`)
  }

  const handleResetSettings = () => {
    resetSettings()
    success('Settings reset', 'All settings have been restored to defaults')
  }

  const handleNotificationChange = (key: keyof typeof settings.notifications) => {
    updateSettings({
      notifications: {
        ...settings.notifications,
        [key]: !settings.notifications[key],
      },
    })
  }

  const handleAccessibilityChange = (key: keyof typeof settings.accessibility) => {
    updateSettings({
      accessibility: {
        ...settings.accessibility,
        [key]: !settings.accessibility[key],
      },
    })
  }

  return (
    <div className="container mx-auto p-6 section-spacing max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-helm-gold-surface border border-helm-gold-border">
            <span className="type-caption text-helm-gold">Helm</span>
          </div>
          <div>
            <h1 className="type-h1">Settings</h1>
            <p className="type-body text-helm-secondary">
              Manage your account preferences and application settings
            </p>
          </div>
        </div>
      </div>

      {/* Live Settings Preview */}
      <Card variant="outline" className="border-helm-gold-border bg-helm-gold-surface/30">
        <CardHeader>
          <CardTitle>Live Preview</CardTitle>
          <CardDescription>See your localization settings in action</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="type-label text-helm-muted mb-1">Theme Mode</div>
              <div className="type-h3 capitalize">{settings.theme}</div>
            </div>
            <div>
              <div className="type-label text-helm-muted mb-1">Density</div>
              <div className="type-h3 capitalize">{settings.density}</div>
            </div>
            <div>
              <div className="type-label text-helm-muted mb-1">Sample Amount</div>
              <div className="type-h3">{formatCurrency(1234567)}</div>
              <div className="text-xs text-helm-secondary mt-1">{formatCurrencyDetailed(1234.56)}</div>
            </div>
            <div>
              <div className="type-label text-helm-muted mb-1">Sample Date</div>
              <div className="type-h3">{formatDate(new Date())}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-helm-gold-surface border border-helm-gold-border">
                <User className="w-4 h-4 text-helm-gold" />
              </div>
              <div>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </div>
            <Button onClick={handleSaveProfile} className="w-full">
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-helm-gold-surface border border-helm-gold-border">
                <Palette className="w-4 h-4 text-helm-gold" />
              </div>
              <div>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize how the app looks and feels</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Theme Selector */}
            <div className="space-y-3">
              <Label>Theme</Label>
              <div className="grid grid-cols-3 gap-3">
                {(['light', 'dark', 'auto'] as const).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => handleThemeChange(theme)}
                    className={`
                      p-3 rounded-md border-2 transition-all type-label
                      ${
                        settings.theme === theme
                          ? 'border-helm-gold bg-helm-gold-surface text-helm-gold'
                          : 'border-helm-border-base bg-helm-elevated text-helm-secondary hover:border-helm-border-strong hover:text-helm-platinum'
                      }
                    `}
                  >
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Density Selector */}
            <div className="space-y-3">
              <Label>Dashboard Density</Label>
              <div className="grid grid-cols-3 gap-3">
                {(['compact', 'comfortable', 'spacious'] as const).map((density) => (
                  <button
                    key={density}
                    onClick={() => handleDensityChange(density)}
                    className={`
                      p-3 rounded-md border-2 transition-all type-label
                      ${
                        settings.density === density
                          ? 'border-helm-gold bg-helm-gold-surface text-helm-gold'
                          : 'border-helm-border-base bg-helm-elevated text-helm-secondary hover:border-helm-border-strong hover:text-helm-platinum'
                      }
                    `}
                  >
                    {density.charAt(0).toUpperCase() + density.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-helm-gold-surface border border-helm-gold-border">
                <Bell className="w-4 h-4 text-helm-gold" />
              </div>
              <div>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose what you want to be notified about</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { key: 'marketAlerts', label: 'Market Alerts', description: 'Price movements and market events' },
              { key: 'transactionAlerts', label: 'Transaction Alerts', description: 'Unusual transactions and spending' },
              { key: 'budgetAlerts', label: 'Budget Alerts', description: 'Budget threshold notifications' },
              { key: 'taxReminders', label: 'Tax Reminders', description: 'Tax deadlines and opportunities' },
              { key: 'weeklyDigest', label: 'Weekly Digest', description: 'Weekly summary of your finances' },
              { key: 'monthlyReport', label: 'Monthly Report', description: 'Comprehensive monthly analysis' },
            ].map((notification) => (
              <div
                key={notification.key}
                className="flex items-center justify-between p-3 bg-helm-elevated rounded-md border border-helm-border-subtle hover:border-helm-border-base transition-colors"
              >
                <div className="flex-1 mr-4">
                  <p className="type-h3 mb-0.5">{notification.label}</p>
                  <p className="text-helm-secondary text-xs">{notification.description}</p>
                </div>
                <Switch
                  checked={settings.notifications[notification.key as keyof typeof settings.notifications]}
                  onCheckedChange={() => handleNotificationChange(notification.key as keyof typeof settings.notifications)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-helm-gold-surface border border-helm-gold-border">
                <Shield className="w-4 h-4 text-helm-gold" />
              </div>
              <div>
                <CardTitle>Security</CardTitle>
                <CardDescription>Protect your account and data</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-helm-elevated rounded-md border border-helm-border-base">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-helm-muted" />
                <div>
                  <p className="type-h3">Password</p>
                  <p className="text-helm-secondary text-xs">Last changed 3 months ago</p>
                </div>
              </div>
              <Button variant="outline" size="sm">Change</Button>
            </div>

            <div className="flex items-center justify-between p-4 bg-helm-elevated rounded-md border border-helm-border-base">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-helm-muted" />
                <div>
                  <p className="type-h3">Two-Factor Authentication</p>
                  <p className="text-helm-positive text-xs">Enabled via SMS</p>
                </div>
              </div>
              <Button variant="outline" size="sm">Manage</Button>
            </div>

            <div className="flex items-center justify-between p-4 bg-helm-elevated rounded-md border border-helm-border-base">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-helm-muted" />
                <div>
                  <p className="type-h3">Active Sessions</p>
                  <p className="text-helm-secondary text-xs">2 active devices</p>
                </div>
              </div>
              <Button variant="outline" size="sm">View</Button>
            </div>
          </CardContent>
        </Card>

        {/* Localization Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-helm-gold-surface border border-helm-gold-border">
                <Globe className="w-4 h-4 text-helm-gold" />
              </div>
              <div>
                <CardTitle>Localization</CardTitle>
                <CardDescription>Currency, date, and number formats</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['USD', 'EUR', 'GBP'] as const).map((currency) => (
                  <button
                    key={currency}
                    onClick={() => updateSettings({ currency })}
                    className={`
                      p-2 rounded-md border transition-all type-label
                      ${
                        settings.currency === currency
                          ? 'border-helm-gold bg-helm-gold-surface text-helm-gold'
                          : 'border-helm-border-base bg-helm-elevated text-helm-secondary hover:border-helm-border-strong'
                      }
                    `}
                  >
                    {currency}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Date Format</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] as const).map((format) => (
                  <button
                    key={format}
                    onClick={() => updateSettings({ dateFormat: format })}
                    className={`
                      p-2 rounded-md border transition-all type-caption text-[9px]
                      ${
                        settings.dateFormat === format
                          ? 'border-helm-gold bg-helm-gold-surface text-helm-gold'
                          : 'border-helm-border-base bg-helm-elevated text-helm-secondary hover:border-helm-border-strong'
                      }
                    `}
                  >
                    {format}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accessibility Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-helm-gold-surface border border-helm-gold-border">
                <Accessibility className="w-4 h-4 text-helm-gold" />
              </div>
              <div>
                <CardTitle>Accessibility</CardTitle>
                <CardDescription>Customize for your needs</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { key: 'reduceMotion', label: 'Reduce Motion', description: 'Minimize animations and transitions', activeMessage: 'Animations disabled' },
              { key: 'highContrast', label: 'High Contrast', description: 'Increase border and text contrast', activeMessage: 'Enhanced contrast active' },
              { key: 'largeText', label: 'Large Text', description: 'Increase base font size by 15%', activeMessage: 'Text size increased' },
              { key: 'screenReaderOptimized', label: 'Screen Reader', description: 'Optimize for screen readers', activeMessage: 'SR optimizations active' },
            ].map((option) => (
              <div
                key={option.key}
                className={`flex items-center justify-between p-3 rounded-md border transition-colors ${
                  settings.accessibility[option.key as keyof typeof settings.accessibility]
                    ? 'bg-helm-gold-surface border-helm-gold-border'
                    : 'bg-helm-elevated border-helm-border-subtle hover:border-helm-border-base'
                }`}
              >
                <div className="flex-1 mr-4">
                  <div className="flex items-center gap-2">
                    <p className="type-h3 mb-0.5">{option.label}</p>
                    {settings.accessibility[option.key as keyof typeof settings.accessibility] && (
                      <Badge variant="gold" className="text-xs">{option.activeMessage}</Badge>
                    )}
                  </div>
                  <p className="text-helm-secondary text-xs">{option.description}</p>
                </div>
                <Switch
                  checked={settings.accessibility[option.key as keyof typeof settings.accessibility]}
                  onCheckedChange={() => handleAccessibilityChange(option.key as keyof typeof settings.accessibility)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Billing & Subscription */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-helm-gold-surface border border-helm-gold-border">
                <CreditCard className="w-4 h-4 text-helm-gold" />
              </div>
              <div>
                <CardTitle>Billing & Subscription</CardTitle>
                <CardDescription>Manage your subscription and payment</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-helm-gold-surface border border-helm-gold-border rounded-md">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="type-h3">Premium Plan</p>
                  <p className="text-helm-platinum">$29.99/month</p>
                </div>
                <Badge variant="gold">Active</Badge>
              </div>
              <p className="text-helm-secondary text-xs mb-3">Next billing date: April 15, 2024</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">Change Plan</Button>
                <Button variant="outline" size="sm" className="flex-1">Cancel</Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="flex items-center justify-between p-3 bg-helm-elevated rounded-md border border-helm-border-base">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-helm-muted" />
                  <div>
                    <p className="type-h3">•••• •••• •••• 4242</p>
                    <p className="text-helm-secondary text-xs">Expires 12/2026</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Update</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data & Privacy */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-helm-gold-surface border border-helm-gold-border">
                <Database className="w-4 h-4 text-helm-gold" />
              </div>
              <div>
                <CardTitle>Data & Privacy</CardTitle>
                <CardDescription>Control your data and privacy settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between p-3 bg-helm-elevated rounded-md border border-helm-border-subtle hover:border-helm-border-base transition-colors">
                <div className="flex-1 mr-4">
                  <p className="type-h3 mb-0.5">Analytics</p>
                  <p className="text-helm-secondary text-xs">Help improve Helm with usage data</p>
                </div>
                <Switch
                  checked={settings.analyticsEnabled}
                  onCheckedChange={(checked) => updateSettings({ analyticsEnabled: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-helm-elevated rounded-md border border-helm-border-subtle hover:border-helm-border-base transition-colors">
                <div className="flex-1 mr-4">
                  <p className="type-h3 mb-0.5">Crash Reporting</p>
                  <p className="text-helm-secondary text-xs">Automatically report errors</p>
                </div>
                <Switch
                  checked={settings.crashReportingEnabled}
                  onCheckedChange={(checked) => updateSettings({ crashReportingEnabled: checked })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-helm-elevated rounded-md border border-helm-border-base">
              <div>
                <p className="type-h3">Export Your Data</p>
                <p className="text-helm-secondary text-xs">Download all your financial data</p>
              </div>
              <Button variant="outline" size="sm">Export</Button>
            </div>

            <div className="flex items-center justify-between p-3 bg-helm-negative/5 border border-helm-negative/20 rounded-md">
              <div>
                <p className="type-h3 text-helm-negative">Delete Account</p>
                <p className="text-xs" style={{ color: 'var(--color-negative)' }}>Permanently delete your account and data</p>
              </div>
              <Button variant="destructive" size="sm">
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reset Settings */}
      <Card variant="outline">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="type-h3 mb-1">Reset All Settings</p>
              <p className="type-body text-helm-secondary">Restore all settings to their default values</p>
            </div>
            <Button variant="outline" onClick={handleResetSettings}>
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
