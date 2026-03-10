'use client'

import { useState, useEffect, useMemo } from 'react'
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
  Accessibility,
  Loader2,
  X,
  Eye,
  EyeOff,
  Monitor,
  LogOut,
  AlertTriangle,
  Check,
  Clock,
} from 'lucide-react'

// ── Password strength (mirrors server-side logic) ──

interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4
  label: string
  color: string
  requirements: { label: string; met: boolean }[]
}

function getPasswordStrength(password: string): PasswordStrength {
  const requirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Number', met: /\d/.test(password) },
    { label: 'Special character', met: /[^A-Za-z0-9]/.test(password) },
  ]
  const metCount = requirements.filter(r => r.met).length
  const score = Math.min(4, metCount) as 0 | 1 | 2 | 3 | 4
  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = [
    'bg-[var(--color-negative)]',
    'bg-[var(--color-negative)]',
    'bg-[var(--color-warning)]',
    'bg-[var(--color-positive)]/70',
    'bg-[var(--color-positive)]',
  ]
  return { score, label: labels[score], color: colors[score], requirements }
}

// ── Login activity types ──

interface LoginEvent {
  id: string
  eventType: string
  browser: string
  os: string
  device: string
  ipAddress: string
  createdAt: string
}

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings, formatCurrency, formatCurrencyDetailed, formatDate } = useSettings()
  const { success, info, error: showError } = useToast()

  // Profile state
  const [profile, setProfile] = useState({ name: '', email: '', phone: '' })
  const [profileLoading, setProfileLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' })
  const [changingPassword, setChangingPassword] = useState(false)
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false })

  // Login activity state
  const [loginActivity, setLoginActivity] = useState<LoginEvent[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const [revokingOthers, setRevokingOthers] = useState(false)

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Password strength computation
  const passwordStrength = useMemo(
    () => getPasswordStrength(passwordForm.new),
    [passwordForm.new],
  )

  // Load profile
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          const data = await res.json()
          setProfile({
            name: data.profile?.full_name || '',
            email: data.profile?.email || '',
            phone: data.profile?.phone || '',
          })
        }
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setProfileLoading(false)
      }
    }
    loadProfile()
  }, [])

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: profile.name, phone: profile.phone }),
      })
      if (res.ok) {
        success('Profile updated', 'Your changes have been saved successfully')
      } else {
        showError('Save failed', 'Could not save your profile. Please try again.')
      }
    } catch {
      showError('Save failed', 'An error occurred while saving your profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/user/export')
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `helm-export-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        success('Export complete', 'Your data has been downloaded')
      } else {
        showError('Export failed', 'Could not export your data. Please try again.')
      }
    } catch {
      showError('Export failed', 'An error occurred while exporting your data.')
    } finally {
      setExporting(false)
    }
  }

  const handlePasswordChange = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      showError('Password mismatch', 'New passwords do not match')
      return
    }
    if (passwordStrength.score < 3) {
      showError('Weak password', 'Password must meet at least 4 of 5 requirements')
      return
    }

    setChangingPassword(true)
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwordForm.current, newPassword: passwordForm.new }),
      })
      const data = await res.json()
      if (res.ok) {
        success('Password changed', 'Your password has been updated successfully')
        setShowPasswordModal(false)
        setPasswordForm({ current: '', new: '', confirm: '' })
      } else {
        showError('Change failed', data.error || 'Could not change password')
      }
    } catch {
      showError('Change failed', 'An error occurred while changing password')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleFetchActivity = async () => {
    if (showActivity) {
      setShowActivity(false)
      return
    }
    setActivityLoading(true)
    try {
      const res = await fetch('/api/auth/sessions')
      if (res.ok) {
        const data = await res.json()
        setLoginActivity(data.activity || [])
        setShowActivity(true)
      } else {
        showError('Failed', 'Could not load login activity')
      }
    } catch {
      showError('Failed', 'Could not load login activity')
    } finally {
      setActivityLoading(false)
    }
  }

  const handleRevokeOtherSessions = async () => {
    setRevokingOthers(true)
    try {
      const res = await fetch('/api/auth/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke_others' }),
      })
      if (res.ok) {
        success('Sessions revoked', 'All other devices have been signed out')
      } else {
        showError('Failed', 'Could not revoke other sessions')
      }
    } catch {
      showError('Failed', 'An error occurred')
    } finally {
      setRevokingOthers(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      showError('Confirmation required', 'Please type DELETE to confirm')
      return
    }
    if (!deletePassword) {
      showError('Password required', 'Please enter your password')
      return
    }

    setDeleting(true)
    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword, confirmation: deleteConfirmation }),
      })
      const data = await res.json()
      if (res.ok) {
        // Redirect to home after account deletion
        window.location.href = '/'
      } else {
        showError('Deletion failed', data.error || 'Could not delete account')
      }
    } catch {
      showError('Deletion failed', 'An error occurred while deleting your account')
    } finally {
      setDeleting(false)
    }
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
    updateSettings({ notifications: { ...settings.notifications, [key]: !settings.notifications[key] } })
  }

  const handleAccessibilityChange = (key: keyof typeof settings.accessibility) => {
    updateSettings({ accessibility: { ...settings.accessibility, [key]: !settings.accessibility[key] } })
  }

  function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="container mx-auto p-6 section-spacing max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-md bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)]">
            <span className="type-caption text-[var(--color-gold)]">Helm</span>
          </div>
          <div>
            <h1 className="type-h1">Settings</h1>
            <p className="type-body text-[var(--color-text-secondary)]">
              Manage your account preferences and application settings
            </p>
          </div>
        </div>
      </div>

      {/* Live Settings Preview */}
      <Card variant="outline" className="border-[var(--color-gold-border)] bg-[var(--color-gold-surface)]/30">
        <CardHeader>
          <CardTitle>Live Preview</CardTitle>
          <CardDescription>See your localization settings in action</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="type-label text-[var(--color-text-muted)] mb-1">Theme Mode</div>
              <div className="type-h3 capitalize">{settings.theme}</div>
            </div>
            <div>
              <div className="type-label text-[var(--color-text-muted)] mb-1">Density</div>
              <div className="type-h3 capitalize">{settings.density}</div>
            </div>
            <div>
              <div className="type-label text-[var(--color-text-muted)] mb-1">Sample Amount</div>
              <div className="type-h3">{formatCurrency(1234567)}</div>
              <div className="text-xs text-[var(--color-text-secondary)] mt-1">{formatCurrencyDetailed(1234.56)}</div>
            </div>
            <div>
              <div className="type-label text-[var(--color-text-muted)] mb-1">Sample Date</div>
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
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)]">
                <User className="w-4 h-4 text-[var(--color-gold)]" />
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
              <Input id="name" type="text" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={profile.email} disabled className="opacity-60" />
              <p className="text-[10px] text-[var(--color-text-muted)]">Contact support to change your email address</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </div>
            <Button onClick={handleSaveProfile} disabled={savingProfile || profileLoading} className="w-full">
              {savingProfile ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>) : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>

        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)]">
                <Palette className="w-4 h-4 text-[var(--color-gold)]" />
              </div>
              <div>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize how the app looks and feels</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Theme</Label>
              <div className="grid grid-cols-3 gap-3">
                {(['light', 'dark', 'auto'] as const).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => handleThemeChange(theme)}
                    className={`p-3 rounded-md border-2 transition-all type-label ${
                      settings.theme === theme
                        ? 'border-[var(--color-gold)] bg-[var(--color-gold-surface)] text-[var(--color-gold)]'
                        : 'border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Dashboard Density</Label>
              <div className="grid grid-cols-3 gap-3">
                {(['compact', 'comfortable', 'spacious'] as const).map((density) => (
                  <button
                    key={density}
                    onClick={() => handleDensityChange(density)}
                    className={`p-3 rounded-md border-2 transition-all type-label ${
                      settings.density === density
                        ? 'border-[var(--color-gold)] bg-[var(--color-gold-surface)] text-[var(--color-gold)]'
                        : 'border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]'
                    }`}
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
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)]">
                <Bell className="w-4 h-4 text-[var(--color-gold)]" />
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
                className="flex items-center justify-between p-3 bg-[var(--color-bg-elevated)] rounded-md border border-[var(--color-border-subtle)] hover:border-[var(--color-border-base)] transition-colors"
              >
                <div className="flex-1 mr-4">
                  <p className="type-h3 mb-0.5">{notification.label}</p>
                  <p className="text-[var(--color-text-secondary)] text-xs">{notification.description}</p>
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
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)]">
                <Shield className="w-4 h-4 text-[var(--color-gold)]" />
              </div>
              <div>
                <CardTitle>Security</CardTitle>
                <CardDescription>Protect your account and data</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Password */}
            <div className="flex items-center justify-between p-4 bg-[var(--color-bg-elevated)] rounded-md border border-[var(--color-border-base)]">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-[var(--color-text-muted)]" />
                <div>
                  <p className="type-h3">Password</p>
                  <p className="text-[var(--color-text-secondary)] text-xs">Secure your account with a strong password</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowPasswordModal(true)}>Change</Button>
            </div>

            {/* Two-Factor Authentication */}
            <div className="flex items-center justify-between p-4 bg-[var(--color-bg-elevated)] rounded-md border border-[var(--color-border-base)]">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-[var(--color-text-muted)]" />
                <div>
                  <p className="type-h3">Two-Factor Authentication</p>
                  <p className="text-[var(--color-text-muted)] text-xs">Not yet enabled</p>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px]">Coming Soon</Badge>
            </div>

            {/* Login Activity */}
            <div className="p-4 bg-[var(--color-bg-elevated)] rounded-md border border-[var(--color-border-base)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Monitor className="w-5 h-5 text-[var(--color-text-muted)]" />
                  <div>
                    <p className="type-h3">Login Activity</p>
                    <p className="text-[var(--color-text-secondary)] text-xs">Recent sign-ins to your account</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFetchActivity}
                  disabled={activityLoading}
                >
                  {activityLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : showActivity ? 'Hide' : 'View'}
                </Button>
              </div>

              {showActivity && (
                <div className="mt-3 space-y-2">
                  {loginActivity.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-muted)] py-2">No recent login activity recorded</p>
                  ) : (
                    loginActivity.map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-2.5 bg-[var(--color-bg-surface)] rounded border border-[var(--color-border-subtle)]"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            event.eventType === 'login_success' ? 'bg-[var(--color-positive)]'
                            : event.eventType === 'password_change' ? 'bg-[var(--color-warning)]'
                            : 'bg-[var(--color-text-muted)]'
                          }`} />
                          <div>
                            <p className="type-label text-xs text-[var(--color-text-primary)]">
                              {event.browser} on {event.os}
                              <span className="text-[var(--color-text-muted)] ml-1">({event.device})</span>
                            </p>
                            <p className="text-[10px] text-[var(--color-text-muted)]">
                              {event.ipAddress !== 'unknown' && `${event.ipAddress} · `}
                              {event.eventType === 'password_change' ? 'Password changed' :
                               event.eventType === 'session_revoke' ? 'Sessions revoked' : 'Sign in'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                          <Clock className="w-3 h-3" />
                          {formatRelativeTime(event.createdAt)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Sign Out Other Devices */}
            <div className="flex items-center justify-between p-4 bg-[var(--color-bg-elevated)] rounded-md border border-[var(--color-border-base)]">
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-[var(--color-text-muted)]" />
                <div>
                  <p className="type-h3">Sign Out Other Devices</p>
                  <p className="text-[var(--color-text-secondary)] text-xs">End all sessions except this one</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRevokeOtherSessions}
                disabled={revokingOthers}
              >
                {revokingOthers ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sign Out'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Localization Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)]">
                <Globe className="w-4 h-4 text-[var(--color-gold)]" />
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
              <div className="grid grid-cols-5 gap-2">
                {(['USD', 'EUR', 'GBP', 'JPY', 'CAD'] as const).map((currency) => (
                  <button
                    key={currency}
                    onClick={() => updateSettings({ currency })}
                    className={`p-2 rounded-md border transition-all type-label ${
                      settings.currency === currency
                        ? 'border-[var(--color-gold)] bg-[var(--color-gold-surface)] text-[var(--color-gold)]'
                        : 'border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
                    }`}
                  >
                    {currency}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Number Format</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'US', label: 'US (1,234.56)' },
                  { value: 'EU', label: 'EU (1.234,56)' },
                  { value: 'UK', label: 'UK (1,234.56)' },
                ] as const).map((format) => (
                  <button
                    key={format.value}
                    onClick={() => updateSettings({ numberFormat: format.value })}
                    className={`p-2 rounded-md border transition-all type-caption text-[9px] ${
                      settings.numberFormat === format.value
                        ? 'border-[var(--color-gold)] bg-[var(--color-gold-surface)] text-[var(--color-gold)]'
                        : 'border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
                    }`}
                  >
                    {format.label}
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
                    className={`p-2 rounded-md border transition-all type-caption text-[9px] ${
                      settings.dateFormat === format
                        ? 'border-[var(--color-gold)] bg-[var(--color-gold-surface)] text-[var(--color-gold)]'
                        : 'border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
                    }`}
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
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)]">
                <Accessibility className="w-4 h-4 text-[var(--color-gold)]" />
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
                    ? 'bg-[var(--color-gold-surface)] border-[var(--color-gold-border)]'
                    : 'bg-[var(--color-bg-elevated)] border-[var(--color-border-subtle)] hover:border-[var(--color-border-base)]'
                }`}
              >
                <div className="flex-1 mr-4">
                  <div className="flex items-center gap-2">
                    <p className="type-h3 mb-0.5">{option.label}</p>
                    {settings.accessibility[option.key as keyof typeof settings.accessibility] && (
                      <Badge variant="gold" className="text-xs">{option.activeMessage}</Badge>
                    )}
                  </div>
                  <p className="text-[var(--color-text-secondary)] text-xs">{option.description}</p>
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
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)]">
                <CreditCard className="w-4 h-4 text-[var(--color-gold)]" />
              </div>
              <div>
                <CardTitle>Billing & Subscription</CardTitle>
                <CardDescription>Manage your subscription and payment</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] rounded-md">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="type-h3">Premium Plan</p>
                  <p className="text-[var(--color-text-primary)]">$29.99/month</p>
                </div>
                <Badge variant="gold">Active</Badge>
              </div>
              <p className="text-[var(--color-text-secondary)] text-xs mb-3">Next billing date: April 15, 2024</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">Change Plan</Button>
                <Button variant="outline" size="sm" className="flex-1">Cancel</Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="flex items-center justify-between p-3 bg-[var(--color-bg-elevated)] rounded-md border border-[var(--color-border-base)]">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-[var(--color-text-muted)]" />
                  <div>
                    <p className="type-h3">•••• •••• •••• 4242</p>
                    <p className="text-[var(--color-text-secondary)] text-xs">Expires 12/2026</p>
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
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)]">
                <Database className="w-4 h-4 text-[var(--color-gold)]" />
              </div>
              <div>
                <CardTitle>Data & Privacy</CardTitle>
                <CardDescription>Control your data and privacy settings</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between p-3 bg-[var(--color-bg-elevated)] rounded-md border border-[var(--color-border-subtle)] hover:border-[var(--color-border-base)] transition-colors">
                <div className="flex-1 mr-4">
                  <p className="type-h3 mb-0.5">Analytics</p>
                  <p className="text-[var(--color-text-secondary)] text-xs">Help improve Helm with usage data</p>
                </div>
                <Switch
                  checked={settings.analyticsEnabled}
                  onCheckedChange={(checked) => updateSettings({ analyticsEnabled: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-[var(--color-bg-elevated)] rounded-md border border-[var(--color-border-subtle)] hover:border-[var(--color-border-base)] transition-colors">
                <div className="flex-1 mr-4">
                  <p className="type-h3 mb-0.5">Crash Reporting</p>
                  <p className="text-[var(--color-text-secondary)] text-xs">Automatically report errors</p>
                </div>
                <Switch
                  checked={settings.crashReportingEnabled}
                  onCheckedChange={(checked) => updateSettings({ crashReportingEnabled: checked })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-[var(--color-bg-elevated)] rounded-md border border-[var(--color-border-base)]">
              <div>
                <p className="type-h3">Export Your Data</p>
                <p className="text-[var(--color-text-secondary)] text-xs">Download all your financial data</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
                {exporting ? (<><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Exporting...</>) : 'Export'}
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 bg-[var(--color-negative)]/5 border border-[var(--color-negative)]/20 rounded-md">
              <div>
                <p className="type-h3 text-[var(--color-negative)]">Delete Account</p>
                <p className="text-xs" style={{ color: 'var(--color-negative)' }}>Permanently delete your account and all data</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteModal(true)}>
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
              <p className="type-body text-[var(--color-text-secondary)]">Restore all settings to their default values</p>
            </div>
            <Button variant="outline" onClick={handleResetSettings}>
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Password Change Modal ── */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowPasswordModal(false)
              setPasswordForm({ current: '', new: '', confirm: '' })
              setShowPasswords({ current: false, new: false, confirm: false })
            }}
          />
          <div className="relative w-full max-w-md mx-4 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[var(--color-border-subtle)]">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-md bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)]">
                  <Lock className="w-5 h-5 text-[var(--color-gold)]" />
                </div>
                <div>
                  <h2 className="type-h2">Change Password</h2>
                  <p className="text-[var(--color-text-secondary)] text-sm">Enter your current and new password</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPasswordModal(false)
                  setPasswordForm({ current: '', new: '', confirm: '' })
                  setShowPasswords({ current: false, new: false, confirm: false })
                }}
                className="p-2 rounded-md hover:bg-[var(--color-bg-elevated)] transition-colors"
              >
                <X className="w-5 h-5 text-[var(--color-text-muted)]" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Current Password */}
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                    placeholder="Enter current password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordForm.new}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                    placeholder="Enter new password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {passwordForm.new && (
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex gap-1">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${
                              i < passwordStrength.score
                                ? passwordStrength.color
                                : 'bg-[var(--color-bg-elevated)]'
                            }`}
                          />
                        ))}
                      </div>
                      <span className={`text-[10px] type-mono ${
                        passwordStrength.score >= 3 ? 'text-[var(--color-positive)]' : 'text-[var(--color-text-muted)]'
                      }`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {passwordStrength.requirements.map((req) => (
                        <div key={req.label} className="flex items-center gap-1.5 text-[10px]">
                          {req.met ? (
                            <Check className="w-3 h-3 text-[var(--color-positive)]" />
                          ) : (
                            <X className="w-3 h-3 text-[var(--color-text-muted)]" />
                          )}
                          <span className={req.met ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'}>
                            {req.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                    placeholder="Confirm new password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordForm.new && passwordForm.confirm && passwordForm.new !== passwordForm.confirm && (
                  <p className="text-xs text-[var(--color-negative)]">Passwords do not match</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--color-border-subtle)]">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPasswordModal(false)
                  setPasswordForm({ current: '', new: '', confirm: '' })
                  setShowPasswords({ current: false, new: false, confirm: false })
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePasswordChange}
                disabled={changingPassword || !passwordForm.current || !passwordForm.new || !passwordForm.confirm || passwordStrength.score < 3}
              >
                {changingPassword ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Changing...</>) : 'Change Password'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Account Modal ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setShowDeleteModal(false)
              setDeleteConfirmation('')
              setDeletePassword('')
            }}
          />
          <div className="relative w-full max-w-md mx-4 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[var(--color-negative)]/20">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-md bg-[var(--color-negative)]/10 border border-[var(--color-negative)]/20">
                  <AlertTriangle className="w-5 h-5 text-[var(--color-negative)]" />
                </div>
                <div>
                  <h2 className="type-h2 text-[var(--color-negative)]">Delete Account</h2>
                  <p className="text-[var(--color-text-secondary)] text-sm">This action is permanent and irreversible</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmation('')
                  setDeletePassword('')
                }}
                className="p-2 rounded-md hover:bg-[var(--color-bg-elevated)] transition-colors"
              >
                <X className="w-5 h-5 text-[var(--color-text-muted)]" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div className="p-3 bg-[var(--color-negative)]/5 border border-[var(--color-negative)]/20 rounded-md">
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  This will permanently delete your account, all linked accounts, transaction history,
                  portfolio data, insights, and settings. This cannot be undone.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delete-password">Your Password</Label>
                <Input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="delete-confirm">
                  Type <span className="type-mono text-[var(--color-negative)]">DELETE</span> to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="DELETE"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--color-border-subtle)]">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmation('')
                  setDeletePassword('')
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmation !== 'DELETE' || !deletePassword}
              >
                {deleting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting...</>) : 'Delete My Account'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
