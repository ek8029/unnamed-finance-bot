'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useSettings } from '@/contexts/settings-context'
import { useToast } from '@/contexts/toast-context'
import { supabase as supabaseBrowser } from '@/lib/supabase/client'
import { useTier } from '@/hooks/use-tier'
import { useAccounts } from '@/hooks/use-financial-data'
import { useFormat } from '@/hooks/use-format'
import { PlaidLinkButton } from '@/components/plaid/plaid-link-button'
import { PlaidUpdateLink } from '@/components/plaid/plaid-update-link'
import { PasswordSection } from './password-section'
import { ProWaitlistButton } from '@/components/pro-waitlist-button'
import posthog from 'posthog-js'
import {
  User,
  Link,
  Bell,
  Calculator,
  Shield,
  CreditCard,
  AlertTriangle,
  Loader2,
  X,
  Lock,
  Smartphone,
  ShieldCheck,
  Copy,
  Monitor,
  LogOut,
  Clock,
  Eye,
  EyeOff,
  Check,
  Plus,
  RefreshCcw,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Download,
  RotateCcw,
} from 'lucide-react'

// ── Types ──

type NavSection =
  | 'profile'
  | 'accounts'
  | 'notifications'
  | 'tax'
  | 'privacy'
  | 'billing'
  | 'danger'

interface NavItem {
  id: NavSection
  label: string
  icon: React.ElementType
}

interface LoginEvent {
  id: string
  eventType: string
  browser: string
  os: string
  device: string
  ipAddress: string
  createdAt: string
}

interface ConnectionHealthItem {
  id: string
  institution_name: string
  status: string
  last_balances_sync: string | null
  last_transactions_sync: string | null
  error_code: string | null
  error_message: string | null
}

// ── Constants ──

const NAV_ITEMS: NavItem[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'accounts', label: 'Accounts', icon: Link },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'tax', label: 'Tax settings', icon: Calculator },
  { id: 'privacy', label: 'Data & privacy', icon: Shield },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'danger', label: 'Danger zone', icon: AlertTriangle },
]

// ── Utilities ──

function formatTimeAgo(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getPasswordStrength(password: string) {
  const requirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Number', met: /\d/.test(password) },
    { label: 'Special character', met: /[^A-Za-z0-9]/.test(password) },
  ]
  const metCount = requirements.filter((r) => r.met).length
  const score = Math.min(4, metCount) as 0 | 1 | 2 | 3 | 4
  return { score, requirements }
}

function getInitials(name: string): string {
  return name
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

const INSTITUTION_COLORS: Record<string, string> = {
  Chase: '#117ACA',
  'Wells Fargo': '#D71E28',
  'Bank of America': '#012169',
  Citibank: '#003B70',
  'Capital One': '#D03027',
  Fidelity: '#4B8B3B',
  Schwab: '#00A0DF',
  Vanguard: '#822729',
  'TD Ameritrade': '#4CAF50',
  Robinhood: '#00C805',
  Coinbase: '#0052FF',
}

function getInstitutionColor(name: string): string {
  for (const [key, color] of Object.entries(INSTITUTION_COLORS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return color
  }
  // Generate a stable color from the name
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 45%, 45%)`
}

// ═══════════════════════════════════════════════════════════
// ██  SETTINGS PAGE
// ═══════════════════════════════════════════════════════════

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings, formatCurrency, formatCurrencyDetailed, formatDate } = useSettings()
  const { formatCurrency: fmtCurrency } = useFormat()
  const { success, info, error: showError } = useToast()
  const { tier, isPro, loading: tierLoading } = useTier()
  const { accounts, loading: accountsLoading, refetch: refetchAccounts } = useAccounts()

  // ── Navigation state ──
  const [activeSection, setActiveSection] = useState<NavSection>('profile')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // ── Profile state ──
  const [profile, setProfile] = useState({ name: '', email: '', phone: '' })
  const [profileLoading, setProfileLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)

  // ── Password modal state ──
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' })
  const [changingPassword, setChangingPassword] = useState(false)
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false, confirm: false })

  // ── Login activity state ──
  const [loginActivity, setLoginActivity] = useState<LoginEvent[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const [revokingOthers, setRevokingOthers] = useState(false)

  // ── MFA state ──
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [mfaLoading, setMfaLoading] = useState(true)
  const [mfaEnrolling, setMfaEnrolling] = useState(false)
  const [mfaQrCode, setMfaQrCode] = useState('')
  const [mfaSecret, setMfaSecret] = useState('')
  const [mfaVerifyCode, setMfaVerifyCode] = useState('')
  const [mfaFactorId, setMfaFactorId] = useState('')
  const [mfaVerifying, setMfaVerifying] = useState(false)
  const [mfaDisabling, setMfaDisabling] = useState(false)

  // ── Billing state ──
  const [billing, setBilling] = useState<{
    tier: string
    billingPeriod: string | null
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
  } | null>(null)

  // ── Delete account state ──
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [isOAuthOnly, setIsOAuthOnly] = useState(false)

  // ── Export state ──
  const [exporting, setExporting] = useState(false)

  // ── Connected accounts state ──
  const [syncing, setSyncing] = useState(false)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null)
  const [accountMenuOpen, setAccountMenuOpen] = useState<string | null>(null)
  const [connectionHealth, setConnectionHealth] = useState<{
    lastSync: string | null
    itemCount: number
    errorCount: number
    items: ConnectionHealthItem[]
  }>({ lastSync: null, itemCount: 0, errorCount: 0, items: [] })

  // ── Tax settings state ──
  const [filingStatus, setFilingStatus] = useState<string>('')
  const [taxBracket, setTaxBracket] = useState<string>('')
  const [taxState, setTaxState] = useState<string>('')
  const [savingTax, setSavingTax] = useState(false)
  const [taxLoaded, setTaxLoaded] = useState(false)

  // ── Sync preferences (local state) ──
  const [syncPrefs, setSyncPrefs] = useState({
    autoSync: true,
    syncOnOpen: true,
    backgroundNotifications: false,
    includeClosedAccounts: false,
  })

  // ── Derived ──
  const passwordStrength = useMemo(
    () => getPasswordStrength(passwordForm.new),
    [passwordForm.new],
  )

  // ═══════════════════════════════════════
  // ██  DATA FETCHING
  // ═══════════════════════════════════════

  useEffect(() => {
    async function loadProfile() {
      try {
        const [res, { data: sessionData }] = await Promise.all([
          fetch('/api/user/profile'),
          supabaseBrowser.auth.getSession(),
        ]);
        if (res.ok) {
          const data = await res.json()
          setProfile({
            name: data.profile?.full_name || '',
            email: data.profile?.email || '',
            phone: data.profile?.phone || '',
          })
        }
        // Detect OAuth-only users (no email/password provider)
        const user = sessionData?.session?.user;
        if (user) {
          const providers = user.app_metadata?.providers as string[] | undefined;
          setIsOAuthOnly(!providers?.includes('email'));
        }
      } catch (err) {
        console.error('Failed to load profile:', err)
      } finally {
        setProfileLoading(false)
      }
    }
    loadProfile()
  }, [])

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

  useEffect(() => {
    async function checkMfaStatus() {
      try {
        const { data } = await supabaseBrowser.auth.mfa.listFactors()
        const verified = data?.totp?.filter((f) => f.status === 'verified') || []
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

  const fetchConnectionHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/plaid/health')
      if (res.ok) {
        const data = await res.json()
        setConnectionHealth(data)
      }
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    fetchConnectionHealth()
  }, [fetchConnectionHealth, syncing])

  // Load tax settings from API
  useEffect(() => {
    async function loadTaxSettings() {
      try {
        const res = await fetch('/api/user/preferences')
        if (res.ok) {
          const data = await res.json()
          const prefs = data.preferences
          if (prefs) {
            setFilingStatus(prefs.filing_status || '')
            setTaxBracket(prefs.tax_bracket || '')
            setTaxState(prefs.tax_state || '')
          }
        }
      } catch (err) {
        console.error('Failed to load tax settings:', err)
      } finally {
        setTaxLoaded(true)
      }
    }
    loadTaxSettings()
  }, [])

  // Check for hash-based section selection (e.g. /settings#accounts)
  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as NavSection
    if (NAV_ITEMS.some((item) => item.id === hash)) {
      setActiveSection(hash)
    }
  }, [])

  // ═══════════════════════════════════════
  // ██  HANDLERS
  // ═══════════════════════════════════════

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
    posthog.capture('billing_clicked');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else if (data.message) {
        info('Billing', data.message)
      } else {
        showError('Billing error', data.error || 'Could not open billing portal.')
      }
    } catch {
      showError('Billing error', 'Could not connect to billing service.')
    }
  }

  const handleSaveTaxSettings = async () => {
    setSavingTax(true)
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filing_status: filingStatus || null,
          tax_bracket: taxBracket || null,
          tax_state: taxState || null,
        }),
      })
      if (res.ok) {
        success('Tax settings saved', 'Your tax configuration has been updated')
      } else {
        showError('Save failed', 'Could not save tax settings. Please try again.')
      }
    } catch {
      showError('Save failed', 'An error occurred while saving tax settings.')
    } finally {
      setSavingTax(false)
    }
  }

  const handleNotificationChange = (key: keyof typeof settings.notifications) => {
    updateSettings({ notifications: { ...settings.notifications, [key]: !settings.notifications[key] } })
  }

  const handleResetSettings = () => {
    resetSettings()
    success('Settings reset', 'All settings have been restored to defaults')
  }

  // ── Connected accounts handlers ──

  const handleSyncAll = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/plaid/sync', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        if (data.synced === 0 || data.message === 'No active Plaid connections to sync') {
          showError('No accounts to sync', 'Connect an account first.')
        } else {
          success('Sync complete', 'All accounts have been synchronized')
        }
        refetchAccounts?.()
      } else {
        const fallback = await fetch('/api/accounts/sync', { method: 'POST' })
        if (fallback.ok) {
          success('Sync complete', 'All accounts have been synchronized')
          refetchAccounts?.()
        } else {
          showError('Sync failed', 'Could not sync accounts. Please try again.')
        }
      }
    } catch {
      showError('Sync failed', 'An error occurred while syncing accounts.')
    } finally {
      setSyncing(false)
    }
  }

  const handlePlaidSuccess = () => {
    success('Account linked', 'Your financial account has been connected successfully')
    setShowAddAccount(false)
    refetchAccounts?.()
    fetchConnectionHealth()
  }

  const handlePlaidError = (error: string) => {
    showError('Connection failed', error)
  }

  const handleDisconnect = async (itemId: string) => {
    const item = connectionHealth.items.find((i) => i.id === itemId)
    const institutionName = item?.institution_name || 'Unknown'
    setDisconnecting(itemId)
    setConfirmDisconnect(null)
    try {
      const res = await fetch(`/api/plaid/items/${itemId}`, { method: 'DELETE' })
      if (res.ok) {
        success('Disconnected', `${institutionName} has been removed`)
        refetchAccounts?.()
        setConnectionHealth((prev) => ({
          ...prev,
          items: prev.items.filter((i) => i.id !== itemId),
          itemCount: prev.itemCount - 1,
        }))
      } else {
        showError('Disconnect failed', 'Could not disconnect. Please try again.')
      }
    } catch {
      showError('Disconnect failed', 'An error occurred.')
    } finally {
      setDisconnecting(null)
    }
  }

  const handleReconnectSuccess = () => {
    success('Reconnected', 'Bank connection has been restored')
    refetchAccounts?.()
    fetchConnectionHealth()
  }

  // Group accounts by institution for the connected accounts view
  const accountsByInstitution = useMemo(() => {
    const map = new Map<string, typeof accounts>()
    for (const acct of accounts) {
      const key = acct.institution || 'Unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(acct)
    }
    return map
  }, [accounts])

  // ═══════════════════════════════════════
  // ██  SECTION RENDERERS
  // ═══════════════════════════════════════

  const renderSectionHeader = (label: string) => (
    <div className="mb-2">
      <p
        className="text-[11px] tracking-[0.12em] uppercase font-semibold text-[var(--color-text-muted)]"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {label}
      </p>
    </div>
  )

  // ── Profile ──
  const renderProfile = () => (
    <div className="space-y-8">
      {renderSectionHeader('Profile')}
      <h2 className="text-[24px] sm:text-[34px] font-semibold text-[var(--color-text-primary)] leading-tight" style={{ fontFamily: 'var(--font-sans)' }}>
        Personal information
      </h2>
      <p className="text-[14px] text-[var(--color-text-secondary)] -mt-4">
        Manage your name, email, and contact information.
      </p>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-[14px]">Full name</Label>
          <Input
            id="name"
            type="text"
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className="bg-[var(--color-bg-elevated)] border-[var(--color-border-base)]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-[14px]">Email</Label>
          <Input
            id="email"
            type="email"
            value={profile.email}
            disabled
            className="bg-[var(--color-bg-elevated)] border-[var(--color-border-base)] opacity-60"
          />
          <p className="text-[11px] text-[var(--color-text-muted)]">Contact support to change your email address</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-[14px]">Phone number</Label>
          <Input
            id="phone"
            type="tel"
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            className="bg-[var(--color-bg-elevated)] border-[var(--color-border-base)]"
          />
        </div>
        <Button
          onClick={handleSaveProfile}
          disabled={savingProfile || profileLoading}
          className="bg-[var(--color-gold)] hover:bg-[var(--color-gold)]/90 text-black font-medium"
        >
          {savingProfile ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save changes'
          )}
        </Button>
      </div>

      {/* Security sub-section within Profile */}
      <div className="pt-8 border-t border-[var(--color-border-subtle)]">
        {renderSectionHeader('Security')}
        <div className="space-y-3 mt-4">
          {/* Password */}
          <div className="flex items-center justify-between p-4 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-base)]">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-[var(--color-text-muted)]" />
              <div>
                <p className="text-[15px] font-medium text-[var(--color-text-primary)]">Password</p>
                <p className="text-[13px] text-[var(--color-text-secondary)]">Secure your account with a strong password</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowPasswordModal(true)}>
              Change
            </Button>
          </div>

          {/* 2FA */}
          <div className="p-4 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-base)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {mfaEnabled ? (
                  <ShieldCheck className="w-5 h-5 text-[var(--color-positive)]" />
                ) : (
                  <Smartphone className="w-5 h-5 text-[var(--color-text-muted)]" />
                )}
                <div>
                  <p className="text-[15px] font-medium text-[var(--color-text-primary)]">Two-factor authentication</p>
                  <p className={`text-[13px] ${mfaEnabled ? 'text-[var(--color-positive)]' : 'text-[var(--color-text-muted)]'}`}>
                    {mfaLoading ? 'Checking...' : mfaEnabled ? 'Enabled via authenticator app' : 'Not yet enabled'}
                  </p>
                </div>
              </div>
              {!mfaLoading && !mfaEnrolling && (
                mfaEnabled ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisableMfa}
                    disabled={mfaDisabling}
                    className="text-[var(--color-negative)] border-[var(--color-negative)]/30 hover:bg-[var(--color-negative)]/10"
                  >
                    {mfaDisabling ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Disable'}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleEnableMfa}>
                    Enable
                  </Button>
                )
              )}
            </div>

            {/* MFA enrollment flow */}
            {mfaEnrolling && mfaQrCode && (
              <div className="mt-4 pt-4 border-t border-[var(--color-border-subtle)] space-y-4">
                <div className="text-center">
                  <p className="text-[13px] text-[var(--color-text-secondary)] mb-3">
                    Scan this QR code with your authenticator app
                  </p>
                  <div className="inline-block bg-white rounded-lg p-3">
                    <img src={mfaQrCode} alt="2FA QR Code" className="w-48 h-48" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-[var(--color-text-muted)] mb-1.5">Or enter this code manually:</p>
                  <div className="inline-flex items-center gap-2">
                    <code className="text-[12px] text-[var(--color-gold)] bg-[var(--color-bg-surface)] px-3 py-1.5 rounded border border-[var(--color-border-base)] select-all" style={{ fontFamily: 'var(--font-mono)' }}>
                      {mfaSecret}
                    </code>
                    <button
                      onClick={handleCopySecret}
                      className="p-1.5 rounded hover:bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] motion-safe:transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-[13px]">Enter the 6-digit code from your app</Label>
                    <Input
                      value={mfaVerifyCode}
                      onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="mt-1 text-center text-lg tracking-[0.5em] bg-[var(--color-bg-surface)] border-[var(--color-border-base)]"
                      style={{ fontFamily: 'var(--font-mono)' }}
                      maxLength={6}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleCancelMfaEnrollment} className="flex-1">
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleVerifyMfa}
                      disabled={mfaVerifyCode.length !== 6 || mfaVerifying}
                      className="flex-1 bg-[var(--color-gold)] hover:bg-[var(--color-gold)]/90 text-black"
                    >
                      {mfaVerifying && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                      Verify & Enable
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Login Activity */}
          <div className="p-4 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-base)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Monitor className="w-5 h-5 text-[var(--color-text-muted)]" />
                <div>
                  <p className="text-[15px] font-medium text-[var(--color-text-primary)]">Login activity</p>
                  <p className="text-[13px] text-[var(--color-text-secondary)]">Recent sign-ins to your account</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleFetchActivity} disabled={activityLoading}>
                {activityLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : showActivity ? 'Hide' : 'View'}
              </Button>
            </div>
            {showActivity && (
              <div className="mt-3 space-y-2">
                {loginActivity.length === 0 ? (
                  <p className="text-[13px] text-[var(--color-text-muted)] py-2">No recent login activity recorded</p>
                ) : (
                  loginActivity.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between p-2.5 bg-[var(--color-bg-surface)] rounded border border-[var(--color-border-subtle)]"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            event.eventType === 'login_success'
                              ? 'bg-[var(--color-positive)]'
                              : event.eventType === 'password_change'
                                ? 'bg-[var(--color-warning-text)]'
                                : 'bg-[var(--color-text-muted)]'
                          }`}
                        />
                        <div>
                          <p className="text-[13px] text-[var(--color-text-primary)]">
                            {event.browser} on {event.os}
                            <span className="text-[var(--color-text-muted)] ml-1">({event.device})</span>
                          </p>
                          <p className="text-[11px] text-[var(--color-text-muted)]">
                            {event.ipAddress !== 'unknown' && `${event.ipAddress} · `}
                            {event.eventType === 'password_change'
                              ? 'Password changed'
                              : event.eventType === 'session_revoke'
                                ? 'Sessions revoked'
                                : 'Sign in'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(event.createdAt)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Sign Out Other Devices */}
          <div className="flex items-center justify-between p-4 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-base)]">
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5 text-[var(--color-text-muted)]" />
              <div>
                <p className="text-[15px] font-medium text-[var(--color-text-primary)]">Sign out other devices</p>
                <p className="text-[13px] text-[var(--color-text-secondary)]">End all sessions except this one</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleRevokeOtherSessions} disabled={revokingOthers}>
              {revokingOthers ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sign Out'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Connected Accounts ──
  const renderAccounts = () => (
    <div className="space-y-8">
      {renderSectionHeader('Connected Accounts')}
      <div>
        <h2 className="text-[24px] sm:text-[34px] font-semibold text-[var(--color-text-primary)] leading-tight" style={{ fontFamily: 'var(--font-sans)' }}>
          Brokerages & banks
        </h2>
        <p className="text-[14px] text-[var(--color-text-secondary)] mt-2">
          Helm connects via Plaid with read-only access. Your credentials are encrypted end-to-end and never touch our servers.
        </p>
      </div>

      {/* Sync controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncAll}
          disabled={syncing}
          className="text-[13px]"
        >
          {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <RefreshCcw className="w-3.5 h-3.5 mr-2" />}
          {syncing ? 'Syncing...' : 'Sync all'}
        </Button>
        {connectionHealth.lastSync && (
          <span className="text-[12px] text-[var(--color-text-muted)]">
            Last sync: {formatTimeAgo(connectionHealth.lastSync)}
          </span>
        )}
      </div>

      {/* Account cards */}
      <div className="space-y-3">
        {accountsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[88px] bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-base)] animate-pulse" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-text-secondary)]">
            <Link className="w-10 h-10 mx-auto mb-3 text-[var(--color-text-muted)]" />
            <p className="text-[14px] mb-1">No accounts connected</p>
            <p className="text-[13px] text-[var(--color-text-muted)]">Link your first account to get started</p>
          </div>
        ) : (
          <>
            {connectionHealth.items.map((item) => {
              const institutionAccounts = accounts.filter(
                (a) => a.institution.toLowerCase() === item.institution_name?.toLowerCase()
              )
              const totalBalance = institutionAccounts.reduce((sum, a) => sum + a.balance, 0)
              const color = getInstitutionColor(item.institution_name || 'Unknown')
              const initials = getInitials(item.institution_name || 'Unknown')
              const isHealthy = item.status === 'active'
              const needsReconnect = item.status === 'error' || item.status === 'login_required'

              return (
                <div
                  key={item.id}
                  className="relative p-4 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-base)] hover:border-[var(--color-border-subtle)] motion-safe:transition-colors"
                >
                  <div className="flex items-center justify-between">
                    {/* Left: logo + info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-semibold text-[13px]"
                        style={{ backgroundColor: color, fontFamily: 'var(--font-sans)' }}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-[var(--color-text-primary)] truncate">
                          {item.institution_name || 'Unknown'}
                        </p>
                        <p className="text-[12px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                          {institutionAccounts.length} account{institutionAccounts.length !== 1 ? 's' : ''}
                          {item.last_balances_sync && (
                            <span className="ml-2">
                              Synced {formatTimeAgo(item.last_balances_sync)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Right: balance + status + menu */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-[16px] font-semibold text-[var(--color-text-primary)] tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                          {fmtCurrency(Math.abs(totalBalance))}
                        </p>
                        {isHealthy && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-positive)] uppercase tracking-wider">
                            <CheckCircle2 className="w-3 h-3" />
                            Healthy
                          </span>
                        )}
                        {needsReconnect && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-warning-text)] uppercase tracking-wider">
                            <AlertCircle className="w-3 h-3" />
                            Reconnect
                          </span>
                        )}
                        {!isHealthy && !needsReconnect && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                            {item.status}
                          </span>
                        )}
                      </div>

                      {/* Three-dot menu */}
                      <div className="relative">
                        <button
                          onClick={() => setAccountMenuOpen(accountMenuOpen === item.id ? null : item.id)}
                          className="p-1.5 rounded-md hover:bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] motion-safe:transition-colors"
                          aria-label={`Options for ${item.institution_name}`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {accountMenuOpen === item.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setAccountMenuOpen(null)} />
                            <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-lg shadow-xl py-1">
                              {needsReconnect && (
                                <button
                                  onClick={() => {
                                    setAccountMenuOpen(null)
                                  }}
                                  className="w-full text-left px-3 py-2 text-[13px] text-[var(--color-warning-text)] hover:bg-[var(--color-bg-elevated)] motion-safe:transition-colors flex items-center gap-2"
                                >
                                  <RefreshCcw className="w-3.5 h-3.5" />
                                  Reconnect
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setAccountMenuOpen(null)
                                  setConfirmDisconnect(item.id)
                                }}
                                className="w-full text-left px-3 py-2 text-[13px] text-[var(--color-negative)] hover:bg-[var(--color-bg-elevated)] motion-safe:transition-colors flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Disconnect
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Reconnect inline for errored items */}
                  {needsReconnect && (
                    <div className="mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
                      <PlaidUpdateLink
                        itemId={item.id}
                        institutionName={item.institution_name || 'Unknown'}
                        onSuccess={handleReconnectSuccess}
                        onError={(err) => showError('Reconnect failed', err)}
                      />
                    </div>
                  )}
                </div>
              )
            })}

            {/* Show accounts without a matching health item */}
            {Array.from(accountsByInstitution.entries())
              .filter(([instName]) => !connectionHealth.items.some(
                (hi) => hi.institution_name?.toLowerCase() === instName.toLowerCase()
              ))
              .map(([instName, accts]) => {
                const totalBalance = accts.reduce((sum, a) => sum + a.balance, 0)
                const color = getInstitutionColor(instName)
                const initials = getInitials(instName)

                return (
                  <div
                    key={instName}
                    className="p-4 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-base)]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-semibold text-[13px]"
                          style={{ backgroundColor: color, fontFamily: 'var(--font-sans)' }}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[15px] font-medium text-[var(--color-text-primary)] truncate">{instName}</p>
                          <p className="text-[12px] text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                            {accts.length} account{accts.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[16px] font-semibold text-[var(--color-text-primary)] tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
                          {fmtCurrency(Math.abs(totalBalance))}
                        </p>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-positive)] uppercase tracking-wider">
                          <CheckCircle2 className="w-3 h-3" />
                          Healthy
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
          </>
        )}

        {/* Add account card */}
        <button
          onClick={() => setShowAddAccount(true)}
          className="w-full p-4 rounded-lg border-2 border-dashed border-[var(--color-border-base)] hover:border-[var(--color-gold)]/50 bg-transparent hover:bg-[var(--color-gold)]/5 motion-safe:transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg border-2 border-dashed border-[var(--color-border-base)] group-hover:border-[var(--color-gold)]/50 flex items-center justify-center motion-safe:transition-colors">
              <Plus className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-gold)] motion-safe:transition-colors" />
            </div>
            <div className="text-left">
              <p className="text-[15px] font-medium text-[var(--color-text-primary)]">Connect another account</p>
              <p className="text-[12px] text-[var(--color-text-muted)]">12,000+ institutions via Plaid</p>
            </div>
          </div>
        </button>
      </div>

      {/* Sync Preferences */}
      <div className="pt-8 border-t border-[var(--color-border-subtle)]">
        {renderSectionHeader('Sync Preferences')}
        <div className="space-y-3 mt-4">
          {[
            { key: 'autoSync', label: 'Auto-sync frequency', description: 'Automatically sync accounts every 6 hours' },
            { key: 'syncOnOpen', label: 'Sync on app open', description: 'Refresh data when you open Helm' },
            { key: 'backgroundNotifications', label: 'Background notifications', description: 'Get notified about sync issues' },
            { key: 'includeClosedAccounts', label: 'Include closed accounts', description: 'Show accounts with zero balance' },
          ].map((pref) => (
            <div
              key={pref.key}
              className="flex items-center justify-between p-4 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-base)]"
            >
              <div className="flex-1 mr-4">
                <p className="text-[15px] font-medium text-[var(--color-text-primary)]">{pref.label}</p>
                <p className="text-[13px] text-[var(--color-text-secondary)]">{pref.description}</p>
              </div>
              <Switch
                checked={syncPrefs[pref.key as keyof typeof syncPrefs]}
                onCheckedChange={(checked) =>
                  setSyncPrefs((prev) => ({ ...prev, [pref.key]: checked }))
                }
                aria-label={pref.label}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Permissions */}
      <div className="pt-8 border-t border-[var(--color-border-subtle)]">
        {renderSectionHeader('Permissions')}
        <div className="mt-4 p-4 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-positive)]/30">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[var(--color-positive)] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[15px] font-medium text-[var(--color-text-primary)]">Read-only access</p>
              <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">
                Helm can only view your account balances, transactions, and holdings. We cannot move money, make trades, or modify your accounts in any way. Your bank credentials are handled entirely by Plaid and never reach our servers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Notifications ──
  const renderNotifications = () => (
    <div className="space-y-8">
      {renderSectionHeader('Notifications')}
      <h2 className="text-[24px] sm:text-[34px] font-semibold text-[var(--color-text-primary)] leading-tight" style={{ fontFamily: 'var(--font-sans)' }}>
        Notification preferences
      </h2>
      <p className="text-[14px] text-[var(--color-text-secondary)] -mt-4">
        Choose what you want to be notified about. Email and push delivery coming soon.
      </p>

      <div className="space-y-3">
        {[
          { key: 'marketAlerts', label: 'Market alerts', description: 'Price movements and market events' },
          { key: 'transactionAlerts', label: 'Transaction alerts', description: 'Unusual transactions and spending' },
          { key: 'budgetAlerts', label: 'Spending alerts', description: 'Get notified about unusual spending patterns' },
          { key: 'taxReminders', label: 'Tax reminders', description: 'Tax deadlines and opportunities' },
          { key: 'weeklyDigest', label: 'Weekly digest', description: 'Weekly summary of your finances' },
          { key: 'monthlyReport', label: 'Monthly report', description: 'Comprehensive monthly analysis' },
        ].map((notification) => (
          <div
            key={notification.key}
            className="flex items-center justify-between p-4 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-base)]"
          >
            <div className="flex-1 mr-4">
              <p className="text-[15px] font-medium text-[var(--color-text-primary)]">{notification.label}</p>
              <p className="text-[13px] text-[var(--color-text-secondary)]">{notification.description}</p>
            </div>
            <Switch
              checked={settings.notifications[notification.key as keyof typeof settings.notifications]}
              onCheckedChange={() => handleNotificationChange(notification.key as keyof typeof settings.notifications)}
              aria-label={notification.label}
            />
          </div>
        ))}
      </div>
    </div>
  )

  // ── Tax Settings ──
  const renderTax = () => (
    <div className="space-y-8">
      {renderSectionHeader('Tax Settings')}
      <h2 className="text-[24px] sm:text-[34px] font-semibold text-[var(--color-text-primary)] leading-tight" style={{ fontFamily: 'var(--font-sans)' }}>
        Tax configuration
      </h2>
      <p className="text-[14px] text-[var(--color-text-secondary)] -mt-4">
        Configure your tax bracket and filing preferences for accurate tax-loss harvesting analysis.
      </p>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-[14px]">Filing status</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(['Single', 'Married Filing Jointly', 'Married Filing Separately', 'Head of Household'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilingStatus(status)}
                className={`p-3 rounded-lg border text-[13px] text-left motion-safe:transition-colors ${
                  filingStatus === status
                    ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10 text-[var(--color-gold)]'
                    : 'border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-gold)]/50'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[14px]">Federal tax bracket</Label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {['10%', '12%', '22%', '24%', '32%', '35%', '37%'].map((bracket) => (
              <button
                key={bracket}
                onClick={() => setTaxBracket(bracket)}
                className={`p-3 sm:p-2 rounded-lg border text-[13px] text-center motion-safe:transition-colors ${
                  taxBracket === bracket
                    ? 'border-[var(--color-gold)] bg-[var(--color-gold)]/10 text-[var(--color-gold)]'
                    : 'border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-gold)]/50'
                }`}
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {bracket}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[14px]">State</Label>
          <Input
            value={taxState}
            onChange={(e) => setTaxState(e.target.value)}
            placeholder="e.g. California, New York"
            className="bg-[var(--color-bg-elevated)] border-[var(--color-border-base)]"
          />
        </div>

        <div className="p-4 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-base)]">
          <p className="text-[13px] text-[var(--color-text-muted)]">
            Tax settings are used to estimate tax-loss harvesting opportunities and projected tax liability. This is not tax advice. Consult a qualified tax professional for your specific situation.
          </p>
        </div>

        <Button
          onClick={handleSaveTaxSettings}
          disabled={savingTax}
          className="bg-[var(--color-gold)] hover:bg-[var(--color-gold)]/90 text-black font-medium"
        >
          {savingTax ? (
            <>
              <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
              Saving...
            </>
          ) : (
            'Save tax settings'
          )}
        </Button>
      </div>
    </div>
  )

  // ── Data & Privacy ──
  const renderPrivacy = () => (
    <div className="space-y-8">
      {renderSectionHeader('Data & Privacy')}
      <h2 className="text-[24px] sm:text-[34px] font-semibold text-[var(--color-text-primary)] leading-tight" style={{ fontFamily: 'var(--font-sans)' }}>
        Your data
      </h2>
      <p className="text-[14px] text-[var(--color-text-secondary)] -mt-4">
        Control how your data is used and export or delete your information.
      </p>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-base)]">
          <div className="flex-1 mr-4">
            <p className="text-[15px] font-medium text-[var(--color-text-primary)]">Analytics</p>
            <p className="text-[13px] text-[var(--color-text-secondary)]">Help improve Helm with anonymous usage data</p>
          </div>
          <Switch
            checked={settings.analyticsEnabled}
            onCheckedChange={(checked) => updateSettings({ analyticsEnabled: checked })}
            aria-label="Analytics"
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-base)]">
          <div className="flex-1 mr-4">
            <p className="text-[15px] font-medium text-[var(--color-text-primary)]">Crash reporting</p>
            <p className="text-[13px] text-[var(--color-text-secondary)]">Automatically report errors to help us fix issues</p>
          </div>
          <Switch
            checked={settings.crashReportingEnabled}
            onCheckedChange={(checked) => updateSettings({ crashReportingEnabled: checked })}
            aria-label="Crash reporting"
          />
        </div>
      </div>

      <div className="pt-6 border-t border-[var(--color-border-subtle)] space-y-3">
        <div className="flex items-center justify-between p-4 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-base)]">
          <div className="flex items-center gap-3">
            <Download className="w-5 h-5 text-[var(--color-text-muted)]" />
            <div>
              <p className="text-[15px] font-medium text-[var(--color-text-primary)]">Export your data</p>
              <p className="text-[13px] text-[var(--color-text-secondary)]">Download all your financial data as JSON</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <>
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                Exporting...
              </>
            ) : (
              'Export'
            )}
          </Button>
        </div>

        <div className="flex items-center justify-between p-4 bg-[var(--color-bg-elevated)] rounded-lg border border-[var(--color-border-base)]">
          <div className="flex items-center gap-3">
            <RotateCcw className="w-5 h-5 text-[var(--color-text-muted)]" />
            <div>
              <p className="text-[15px] font-medium text-[var(--color-text-primary)]">Reset all settings</p>
              <p className="text-[13px] text-[var(--color-text-secondary)]">Restore all settings to their default values</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleResetSettings}>
            Reset
          </Button>
        </div>
      </div>
    </div>
  )

  // ── Billing ──
  const renderBilling = () => (
    <div className="space-y-8">
      {renderSectionHeader('Billing')}
      <h2 className="text-[24px] sm:text-[34px] font-semibold text-[var(--color-text-primary)] leading-tight" style={{ fontFamily: 'var(--font-sans)' }}>
        Subscription
      </h2>
      <p className="text-[14px] text-[var(--color-text-secondary)] -mt-4">
        Manage your plan and billing information.
      </p>

      <div className="space-y-4">
        {tierLoading || billing === null ? (
          <div className="p-6 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-lg">
            <div className="h-6 w-32 bg-white/5 rounded animate-pulse mb-2" />
            <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
          </div>
        ) : billing.tier === 'lifetime' ? (
          <div className="p-6 bg-[var(--color-bg-elevated)] border border-[var(--color-gold)]/30 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[18px] font-semibold text-[var(--color-text-primary)]">Lifetime Plan</p>
                <p className="text-[14px] text-[var(--color-text-secondary)]">Lifetime access to all features</p>
              </div>
              <Badge className="bg-[var(--color-gold)]/10 text-[var(--color-gold)] border-[var(--color-gold)]/30">Lifetime</Badge>
            </div>
            <p className="text-[13px] text-[var(--color-text-muted)]">
              Unlimited AI analysis, tax-loss harvesting, earnings impact, Portfolio Wrapped, and full intelligence feed.
            </p>
          </div>
        ) : billing.tier === 'pro' ? (
          <div className="p-6 bg-[var(--color-bg-elevated)] border border-[var(--color-gold)]/30 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[18px] font-semibold text-[var(--color-text-primary)]">
                  {billing.billingPeriod === 'annual' ? 'Pro Annual' : 'Pro Monthly'}
                </p>
                {billing.currentPeriodEnd && (
                  <p className="text-[14px] text-[var(--color-text-secondary)] mt-0.5">
                    {billing.cancelAtPeriodEnd
                      ? `Cancels on ${new Date(billing.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                      : `Renews on ${new Date(billing.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`}
                  </p>
                )}
              </div>
              <Badge className="bg-[var(--color-gold)]/10 text-[var(--color-gold)] border-[var(--color-gold)]/30">Active</Badge>
            </div>
            <p className="text-[13px] text-[var(--color-text-muted)] mb-4">
              Unlimited AI analysis, tax-loss harvesting, earnings impact, Portfolio Wrapped, and full intelligence feed.
            </p>
            <Button variant="outline" size="sm" onClick={handleManageBilling}>
              Manage billing
            </Button>
          </div>
        ) : (
          <div className="p-6 bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[18px] font-semibold text-[var(--color-text-primary)]">Free Plan</p>
                <p className="text-[14px] text-[var(--color-text-secondary)]">3 AI analyses per day, basic alerts</p>
              </div>
              <Badge variant="outline">Free</Badge>
            </div>
            <a href="/pricing">
              <Button className="bg-[var(--color-gold)] hover:bg-[var(--color-gold)]/90 text-black font-medium">
                Upgrade to Pro
              </Button>
            </a>
          </div>
        )}
      </div>
    </div>
  )

  // ── Danger Zone ──
  const renderDanger = () => (
    <div className="space-y-8">
      {renderSectionHeader('Danger Zone')}
      <h2 className="text-[24px] sm:text-[34px] font-semibold text-[var(--color-negative)] leading-tight" style={{ fontFamily: 'var(--font-sans)' }}>
        Danger zone
      </h2>
      <p className="text-[14px] text-[var(--color-text-secondary)] -mt-4">
        Irreversible actions that affect your account and data.
      </p>

      <div className="p-4 sm:p-6 bg-[var(--color-negative)]/5 border border-[var(--color-negative)]/20 rounded-lg">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div>
            <p className="text-[16px] font-semibold text-[var(--color-negative)]">Delete account</p>
            <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">
              Permanently delete your account, all connected accounts, transaction history, portfolio data, insights, and settings. This action cannot be undone.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
            className="flex-shrink-0 w-full sm:w-auto"
          >
            Delete account
          </Button>
        </div>
      </div>
    </div>
  )

  // ── Section router ──
  const renderActiveSection = () => {
    switch (activeSection) {
      case 'profile':
        return renderProfile()
      case 'accounts':
        return renderAccounts()
      case 'notifications':
        return renderNotifications()
      case 'tax':
        return renderTax()
      case 'privacy':
        return renderPrivacy()
      case 'billing':
        return renderBilling()
      case 'danger':
        return renderDanger()
      default:
        return renderProfile()
    }
  }

  // ═══════════════════════════════════════
  // ██  RENDER
  // ═══════════════════════════════════════

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)]">
      <div className="flex flex-col lg:flex-row max-w-[1400px] mx-auto">
        {/* ── Side Navigation (desktop) ── */}
        <aside className="hidden lg:block w-[220px] flex-shrink-0 border-r border-[var(--color-border-subtle)] min-h-screen sticky top-0">
          <div className="p-6 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[11px] tracking-[0.15em] uppercase font-semibold text-[var(--color-text-muted)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Helm
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)]">/</span>
              <span
                className="text-[11px] tracking-[0.15em] uppercase font-semibold text-[var(--color-text-muted)]"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Settings
              </span>
            </div>
            <h1 className="text-[20px] font-semibold text-[var(--color-text-primary)] mt-3" style={{ fontFamily: 'var(--font-sans)' }}>
              Preferences
            </h1>
          </div>

          <nav className="px-3 pb-6" aria-label="Settings navigation">
            <ul className="space-y-0.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const isActive = activeSection === item.id
                const isDanger = item.id === 'danger'

                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        setActiveSection(item.id)
                        window.history.replaceState(null, '', `#${item.id}`)
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] motion-safe:transition-all relative ${
                        isActive
                          ? 'bg-[var(--color-gold)]/10 text-[var(--color-gold)] font-medium'
                          : isDanger
                            ? 'text-[var(--color-text-secondary)] hover:text-[var(--color-negative)] hover:bg-[var(--color-negative)]/5'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[var(--color-gold)] rounded-r-full" />
                      )}
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[var(--color-gold)]' : isDanger && !isActive ? '' : ''}`} />
                      <span>{item.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        {/* ── Mobile Navigation — sticky top strip, below top bar ── */}
        <nav className="lg:hidden sticky top-[52px] z-20 bg-[var(--color-bg-surface)] border-b border-[var(--color-border-base)] px-2 py-2" aria-label="Settings navigation">
          <div className="flex items-center justify-between overflow-x-auto gap-1 no-scrollbar" role="tablist" aria-label="Settings sections">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = activeSection === item.id
              return (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActiveSection(item.id)}
                  className={`flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-md min-w-[48px] text-[10px] motion-safe:transition-colors ${
                    isActive
                      ? 'text-[var(--color-gold)]'
                      : 'text-[var(--color-text-muted)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="truncate max-w-[56px]">{item.label.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* ── Main Content ── */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-10">
          {/* Mobile header */}
          <div className="lg:hidden mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] tracking-[0.15em] uppercase font-semibold text-[var(--color-text-muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
                Helm / Settings
              </span>
            </div>
          </div>

          {renderActiveSection()}
        </main>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* ██  MODALS                              */}
      {/* ═══════════════════════════════════════ */}

      {/* Password Change Modal */}
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

      {/* Delete Account Modal */}
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
            <div className="flex items-center justify-between p-6 border-b border-[var(--color-negative)]/20">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--color-negative)]/10 border border-[var(--color-negative)]/20">
                  <AlertTriangle className="w-5 h-5 text-[var(--color-negative)]" />
                </div>
                <div>
                  <h2 className="text-[18px] font-semibold text-[var(--color-negative)]">Delete Account</h2>
                  <p className="text-[13px] text-[var(--color-text-secondary)]">This action is permanent and irreversible</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeleteConfirmation('')
                  setDeletePassword('')
                }}
                className="p-2 rounded-md hover:bg-[var(--color-bg-elevated)] motion-safe:transition-colors"
              >
                <X className="w-5 h-5 text-[var(--color-text-muted)]" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-[var(--color-negative)]/5 border border-[var(--color-negative)]/20 rounded-lg">
                <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                  This will permanently delete your account, all linked accounts, transaction history,
                  portfolio data, insights, and settings. This cannot be undone.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delete-password" className="text-[14px]">
                  {isOAuthOnly ? 'Type CONFIRM to verify' : 'Your password'}
                </Label>
                <Input
                  id="delete-password"
                  type={isOAuthOnly ? 'text' : 'password'}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder={isOAuthOnly ? 'CONFIRM' : 'Enter your password'}
                  className="bg-[var(--color-bg-elevated)] border-[var(--color-border-base)]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="delete-confirm" className="text-[14px]">
                  Type <span className="text-[var(--color-negative)]" style={{ fontFamily: 'var(--font-mono)' }}>DELETE</span> to confirm
                </Label>
                <Input
                  id="delete-confirm"
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="DELETE"
                  className="bg-[var(--color-bg-elevated)] border-[var(--color-border-base)]"
                />
              </div>
            </div>

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
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete my account'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {confirmDisconnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setConfirmDisconnect(null)}
          />
          <div className="relative w-[calc(100%-2rem)] max-w-sm bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--color-negative)]/10 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-[var(--color-negative)]" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)]">Disconnect this institution?</h3>
                <p className="text-[13px] text-[var(--color-text-secondary)]">
                  {connectionHealth.items.find((i) => i.id === confirmDisconnect)?.institution_name || 'This institution'}
                </p>
              </div>
            </div>
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              This will remove all associated accounts, transactions, and holdings. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDisconnect(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-[var(--color-negative)] hover:bg-[var(--color-negative)]/90 text-white"
                onClick={() => handleDisconnect(confirmDisconnect)}
              >
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Account Modal */}
      {showAddAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowAddAccount(false)}
          />
          <div className="relative w-[calc(100%-2rem)] max-w-lg bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-base)]">
              <div>
                <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Connect account</h2>
                <p className="text-[13px] text-[var(--color-text-secondary)]">Link a new financial account via Plaid</p>
              </div>
              <button
                className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-md hover:bg-[var(--color-bg-elevated)] motion-safe:transition-colors"
                onClick={() => setShowAddAccount(false)}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-6 space-y-6">
              <p className="text-[13px] text-[var(--color-text-secondary)]">
                Connect your bank accounts, credit cards, and investment accounts securely using Plaid. Your credentials are encrypted end-to-end.
              </p>

              <div className="space-y-3">
                <h3 className="text-[14px] font-medium text-[var(--color-text-primary)]">Supported account types</h3>
                <div className="grid grid-cols-2 gap-2">
                  {['Checking & Savings', 'Credit Cards', 'Investment Accounts', 'Mortgages & Loans'].map((label) => (
                    <div
                      key={label}
                      className="flex items-center p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] rounded-lg"
                    >
                      <span className="text-[13px] text-[var(--color-text-primary)]">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowAddAccount(false)}>
                  Cancel
                </Button>
                <PlaidLinkButton
                  key={showAddAccount ? 'open' : 'closed'}
                  className="flex-1"
                  onSuccess={handlePlaidSuccess}
                  onError={handlePlaidError}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
