'use client'

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, Loader2, X, Eye, EyeOff, Check } from 'lucide-react'

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

export interface PasswordSectionProps {
  showPasswordModal: boolean
  passwordForm: { current: string; new: string; confirm: string }
  setPasswordForm: (form: { current: string; new: string; confirm: string }) => void
  changingPassword: boolean
  showPasswords: { current: boolean; new: boolean; confirm: boolean }
  setShowPasswords: (sp: { current: boolean; new: boolean; confirm: boolean }) => void
  onPasswordChange: () => void
  onClose: () => void
}

export function PasswordSection({
  showPasswordModal,
  passwordForm,
  setPasswordForm,
  changingPassword,
  showPasswords,
  setShowPasswords,
  onPasswordChange,
  onClose,
}: PasswordSectionProps) {
  const passwordStrength = useMemo(
    () => getPasswordStrength(passwordForm.new),
    [passwordForm.new],
  )

  if (!showPasswordModal) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
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
              <p className="text-[var(--color-text-secondary)] text-[15px]">Enter your current and new password</p>
            </div>
          </div>
          <button
            onClick={onClose}
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
              <p className="text-[13px] text-[var(--color-negative)]">Passwords do not match</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--color-border-subtle)]">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={onPasswordChange}
            disabled={changingPassword || !passwordForm.current || !passwordForm.new || !passwordForm.confirm || passwordStrength.score < 3}
          >
            {changingPassword ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Changing...</>) : 'Change Password'}
          </Button>
        </div>
      </div>
    </div>
  )
}
