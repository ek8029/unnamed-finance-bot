'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Shield,
  Lock,
  Smartphone,
  Loader2,
  Monitor,
  LogOut,
  Clock,
  ShieldCheck,
  Copy,
} from 'lucide-react'

export interface LoginEvent {
  id: string
  eventType: string
  browser: string
  os: string
  device: string
  ipAddress: string
  createdAt: string
}

export interface SecuritySectionProps {
  // MFA
  mfaEnabled: boolean
  mfaLoading: boolean
  mfaEnrolling: boolean
  mfaQrCode: string
  mfaSecret: string
  mfaVerifyCode: string
  mfaVerifying: boolean
  mfaDisabling: boolean
  setMfaVerifyCode: (code: string) => void
  onEnableMfa: () => void
  onVerifyMfa: () => void
  onDisableMfa: () => void
  onCancelMfaEnrollment: () => void
  onCopySecret: () => void
  // Password
  onOpenPasswordModal: () => void
  // Login activity
  loginActivity: LoginEvent[]
  activityLoading: boolean
  showActivity: boolean
  onFetchActivity: () => void
  formatRelativeTime: (dateString: string) => string
  // Session revoke
  revokingOthers: boolean
  onRevokeOtherSessions: () => void
}

export function SecuritySection({
  mfaEnabled,
  mfaLoading,
  mfaEnrolling,
  mfaQrCode,
  mfaSecret,
  mfaVerifyCode,
  mfaVerifying,
  mfaDisabling,
  setMfaVerifyCode,
  onEnableMfa,
  onVerifyMfa,
  onDisableMfa,
  onCancelMfaEnrollment,
  onCopySecret,
  onOpenPasswordModal,
  loginActivity,
  activityLoading,
  showActivity,
  onFetchActivity,
  formatRelativeTime,
  revokingOthers,
  onRevokeOtherSessions,
}: SecuritySectionProps) {
  return (
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
              <p className="text-[var(--color-text-secondary)] text-[13px]">Secure your account with a strong password</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onOpenPasswordModal}>Change</Button>
        </div>

        {/* Two-Factor Authentication */}
        <div className="p-4 bg-[var(--color-bg-elevated)] rounded-md border border-[var(--color-border-base)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {mfaEnabled ? (
                <ShieldCheck className="w-5 h-5 text-[var(--color-positive)]" />
              ) : (
                <Smartphone className="w-5 h-5 text-[var(--color-text-muted)]" />
              )}
              <div>
                <p className="type-h3">Two-Factor Authentication</p>
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
                  onClick={onDisableMfa}
                  disabled={mfaDisabling}
                  className="text-[var(--color-negative-text)] border-[var(--color-negative-border)] hover:bg-[var(--color-negative-muted)]"
                >
                  {mfaDisabling ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Disable'}
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={onEnableMfa}>
                  Enable
                </Button>
              )
            )}
          </div>

          {/* Enrollment Flow */}
          {mfaEnrolling && mfaQrCode && (
            <div className="mt-4 pt-4 border-t border-[var(--color-border-subtle)] space-y-4">
              <div className="text-center">
                <p className="text-[15px] text-[var(--color-text-secondary)] mb-3">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.)
                </p>
                <div className="inline-block bg-white rounded-lg p-3">
                  <img src={mfaQrCode} alt="2FA QR Code" className="w-48 h-48" />
                </div>
              </div>

              {/* Manual entry secret */}
              <div className="text-center">
                <p className="text-[13px] text-[var(--color-text-muted)] mb-1.5">Or enter this code manually:</p>
                <div className="inline-flex items-center gap-2">
                  <code className="text-[13px] font-mono text-[var(--color-gold)] bg-[var(--color-bg-surface)] px-3 py-1.5 rounded border border-[var(--color-border-base)] select-all">
                    {mfaSecret}
                  </code>
                  <button
                    onClick={onCopySecret}
                    className="p-1.5 rounded hover:bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Verify code */}
              <div className="space-y-3">
                <div>
                  <Label className="text-[13px]">Enter the 6-digit code from your app</Label>
                  <Input
                    value={mfaVerifyCode}
                    onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="mt-1 text-center text-lg tracking-[0.5em] font-mono"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCancelMfaEnrollment}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={onVerifyMfa}
                    disabled={mfaVerifyCode.length !== 6 || mfaVerifying}
                    className="flex-1 bg-[var(--color-gold)] hover:bg-[var(--color-gold-hi)] text-[var(--color-bg-base)]"
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
        <div className="p-4 bg-[var(--color-bg-elevated)] rounded-md border border-[var(--color-border-base)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Monitor className="w-5 h-5 text-[var(--color-text-muted)]" />
              <div>
                <p className="type-h3">Login Activity</p>
                <p className="text-[var(--color-text-secondary)] text-[13px]">Recent sign-ins to your account</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onFetchActivity}
              disabled={activityLoading}
            >
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
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        event.eventType === 'login_success' ? 'bg-[var(--color-positive)]'
                        : event.eventType === 'password_change' ? 'bg-[var(--color-warning)]'
                        : 'bg-[var(--color-text-muted)]'
                      }`} />
                      <div>
                        <p className="type-label text-[13px] text-[var(--color-text-primary)]">
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
              <p className="text-[var(--color-text-secondary)] text-[13px]">End all sessions except this one</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRevokeOtherSessions}
            disabled={revokingOthers}
          >
            {revokingOthers ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sign Out'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
