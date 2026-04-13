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
import { supabase as supabaseBrowser } from '@/lib/supabase/client'
import { useTier } from '@/hooks/use-tier'
import {
  Bell,
  Palette,
  CreditCard,
  Database,
  Globe,
  Accessibility,
  Loader2,
  X,
  AlertTriangle,
} from 'lucide-react'

import { ProfileSection } from './profile-section'
import { SecuritySection, type LoginEvent } from './security-section'
import { PasswordSection } from './password-section'
import { ProWaitlistButton } from '@/components/pro-waitlist-button'

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings, formatCurrency, formatCurrencyDetailed, formatDate } = useSettings()
  const { success, info, error: showError } = useToast()
  const { tier, isPro, loading: tierLoading } = useTier()

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

  // Billing state
  const [billing, setBilling] = useState<{
    tier: string;
    billingPeriod: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null>(null)

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaLoading, setMfaLoading] = useState(true)
  const [mfaEnrolling, setMfaEnrolling] = useState(false)
  const [mfaQrCode, setMfaQrCode] = useState('')
  const [mfaSecret, setMfaSecret] = useState('')
  const [mfaVerifyCode, setMfaVerifyCode] = useState('')
  const [mfaFactorId, setMfaFactorId] = useState('')
  const [mfaVerifying, setMfaVerifying] = useState(false)
  const [mfaDisabling, setMfaDisabling] = useState(false)

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

  // Load billing data
  useEffect(() => {
    async function fetchBilling() {
      const res = await fetch('/api/user/tier')
      if (res.ok) {
        const data = await res.json()
        setBilling(data)
      }
    }
    fetchBilling()
  }, [])

  // Check MFA status on mount
  useEffect(() => {
    async function checkMfaStatus() {
      try {
        const { data } = await supabaseBrowser.auth.mfa.listFactors()
        const verified = data?.totp?.filter(f => f.status === 'verified') || []
        setMfaEnabled(verified.length > 0)
        if (verified.length > 0) setMfaFactorId(verified[0].id)
      } catch (err) {
        console.error('Failed to check MFA status:', err)
      } finally {
        setMfaLoading(false)
      }
    }
    checkMfaStatus()
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
        window.dispatchEvent(new Event('helm:profile-updated'))
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

  const handleEnableMfa = async () => {
    setMfaEnrolling(true)
    try {
      const { data, error } = await supabaseBrowser.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Helm Authenticator',
      })
      if (error) throw error
      setMfaFactorId(data.id)
      setMfaQrCode(data.totp.qr_code)
      setMfaSecret(data.totp.secret)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not start 2FA setup'
      showError('Setup failed', msg)
      setMfaEnrolling(false)
    }
  }

  const handleVerifyMfa = async () => {
    if (mfaVerifyCode.length !== 6) {
      showError('Invalid code', 'Please enter the 6-digit code from your authenticator app')
      return
    }
    setMfaVerifying(true)
    try {
      const { data: challenge, error: cErr } = await supabaseBrowser.auth.mfa.challenge({ factorId: mfaFactorId })
      if (cErr) throw cErr
      const { error: vErr } = await supabaseBrowser.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaVerifyCode,
      })
      if (vErr) throw vErr
      setMfaEnabled(true)
      setMfaEnrolling(false)
      setMfaQrCode('')
      setMfaSecret('')
      setMfaVerifyCode('')
      success('2FA Enabled', 'Two-factor authentication is now active on your account')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid code. Please try again.'
      showError('Verification failed', msg)
    } finally {
      setMfaVerifying(false)
    }
  }

  const handleDisableMfa = async () => {
    setMfaDisabling(true)
    try {
      const { error } = await supabaseBrowser.auth.mfa.unenroll({ factorId: mfaFactorId })
      if (error) throw error
      setMfaEnabled(false)
      setMfaFactorId('')
      success('2FA Disabled', 'Two-factor authentication has been removed')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not disable 2FA'
      showError('Failed', msg)
    } finally {
      setMfaDisabling(false)
    }
  }

  const handleCancelMfaEnrollment = () => {
    setMfaEnrolling(false)
    setMfaQrCode('')
    setMfaSecret('')
    setMfaVerifyCode('')
    supabaseBrowser.auth.mfa.unenroll({ factorId: mfaFactorId })
  }

  const handleCopySecret = () => {
    navigator.clipboard.writeText(mfaSecret)
    info('Copied', 'Secret copied to clipboard')
  }

  const handlePasswordModalClose = () => {
    setShowPasswordModal(false)
    setPasswordForm({ current: '', new: '', confirm: '' })
    setShowPasswords({ current: false, new: false, confirm: false })
  }

  const handleManageBilling = async () => {
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
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
              <div className="type-label text-[var(--color-text-muted)] mb-1">Currency Format</div>
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
        <ProfileSection
          profile={profile}
          setProfile={setProfile}
          profileLoading={profileLoading}
          savingProfile={savingProfile}
          onSaveProfile={handleSaveProfile}
        />

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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(['light', 'dark', 'auto'] as const).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => handleThemeChange(theme)}
                    className={`p-3 rounded-md border-2 transition-colors type-label ${
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(['compact', 'comfortable', 'spacious'] as const).map((density) => (
                  <button
                    key={density}
                    onClick={() => handleDensityChange(density)}
                    className={`p-3 rounded-md border-2 transition-colors type-label ${
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
            <p className="type-caption text-[var(--color-text-muted)] mb-4">
              Preferences are saved. Email and push delivery coming soon.
            </p>
            {[
              { key: 'marketAlerts', label: 'Market Alerts', description: 'Price movements and market events' },
              { key: 'transactionAlerts', label: 'Transaction Alerts', description: 'Unusual transactions and spending' },
              { key: 'budgetAlerts', label: 'Spending Alerts', description: 'Get notified about unusual spending patterns' },
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
        <SecuritySection
          mfaEnabled={mfaEnabled}
          mfaLoading={mfaLoading}
          mfaEnrolling={mfaEnrolling}
          mfaQrCode={mfaQrCode}
          mfaSecret={mfaSecret}
          mfaVerifyCode={mfaVerifyCode}
          mfaVerifying={mfaVerifying}
          mfaDisabling={mfaDisabling}
          setMfaVerifyCode={setMfaVerifyCode}
          onEnableMfa={handleEnableMfa}
          onVerifyMfa={handleVerifyMfa}
          onDisableMfa={handleDisableMfa}
          onCancelMfaEnrollment={handleCancelMfaEnrollment}
          onCopySecret={handleCopySecret}
          onOpenPasswordModal={() => setShowPasswordModal(true)}
          loginActivity={loginActivity}
          activityLoading={activityLoading}
          showActivity={showActivity}
          onFetchActivity={handleFetchActivity}
          formatRelativeTime={formatRelativeTime}
          revokingOthers={revokingOthers}
          onRevokeOtherSessions={handleRevokeOtherSessions}
        />

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
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {(['USD', 'EUR', 'GBP', 'JPY', 'CAD'] as const).map((currency) => (
                  <button
                    key={currency}
                    onClick={() => updateSettings({ currency })}
                    className={`p-2 rounded-md border transition-colors type-label ${
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([
                  { value: 'US', label: 'US (1,234.56)' },
                  { value: 'EU', label: 'EU (1.234,56)' },
                  { value: 'UK', label: 'UK (1,234.56)' },
                ] as const).map((format) => (
                  <button
                    key={format.value}
                    onClick={() => updateSettings({ numberFormat: format.value })}
                    className={`p-2 rounded-md border transition-colors type-caption text-[9px] ${
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] as const).map((format) => (
                  <button
                    key={format}
                    onClick={() => updateSettings({ dateFormat: format })}
                    className={`p-2 rounded-md border transition-colors type-caption text-[9px] ${
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
                <CardDescription>Manage your subscription plan</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {tierLoading || billing === null ? (
              <div className="p-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-md">
                <div className="h-6 w-32 bg-white/5 rounded animate-pulse mb-2" />
                <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
              </div>
            ) : billing.tier === 'lifetime' ? (
              <div className="p-4 bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="type-h3">Lifetime Plan</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">Lifetime access</p>
                  </div>
                  <Badge variant="gold">Lifetime</Badge>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-2">
                  Unlimited AI analysis, tax-loss harvesting, earnings impact, Portfolio Wrapped, and full intelligence feed.
                </p>
              </div>
            ) : billing.tier === 'pro' ? (
              <div className="p-4 bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="type-h3">
                      {billing.billingPeriod === 'annual' ? 'Pro Annual' : 'Pro Monthly'}
                    </p>
                    {billing.currentPeriodEnd && (
                      <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                        {billing.cancelAtPeriodEnd
                          ? `Cancels on ${new Date(billing.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                          : `Renews on ${new Date(billing.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
                      </p>
                    )}
                  </div>
                  <Badge variant="gold">Active</Badge>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-2">
                  Unlimited AI analysis, tax-loss harvesting, earnings impact, Portfolio Wrapped, and full intelligence feed.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={handleManageBilling}
                >
                  Manage Billing
                </Button>
              </div>
            ) : (
              <div className="p-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-md">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="type-h3">Free Plan</p>
                    <p className="text-[var(--color-text-secondary)] text-sm">3 AI analyses per day, basic alerts</p>
                  </div>
                  <Badge variant="outline">Free</Badge>
                </div>
                <a href="/pricing">
                  <Button variant="accent" size="sm" className="max-w-xs">
                    Upgrade to Pro
                  </Button>
                </a>
              </div>
            )}
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
      <PasswordSection
        showPasswordModal={showPasswordModal}
        passwordForm={passwordForm}
        setPasswordForm={setPasswordForm}
        changingPassword={changingPassword}
        showPasswords={showPasswords}
        setShowPasswords={setShowPasswords}
        onPasswordChange={handlePasswordChange}
        onClose={handlePasswordModalClose}
      />

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

// ── Password strength (kept for validation in handlers) ──

function getPasswordStrength(password: string) {
  const requirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Number', met: /\d/.test(password) },
    { label: 'Special character', met: /[^A-Za-z0-9]/.test(password) },
  ]
  const metCount = requirements.filter(r => r.met).length
  const score = Math.min(4, metCount) as 0 | 1 | 2 | 3 | 4
  return { score, requirements }
}
