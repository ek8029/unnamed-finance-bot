'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Loader2 } from 'lucide-react'

export interface ProfileSectionProps {
  profile: { name: string; email: string; phone: string }
  setProfile: (p: { name: string; email: string; phone: string }) => void
  profileLoading: boolean
  savingProfile: boolean
  onSaveProfile: () => void
}

export function ProfileSection({
  profile,
  setProfile,
  profileLoading,
  savingProfile,
  onSaveProfile,
}: ProfileSectionProps) {
  return (
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
        <Button onClick={onSaveProfile} disabled={savingProfile || profileLoading} className="w-full">
          {savingProfile ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>) : 'Save Changes'}
        </Button>
      </CardContent>
    </Card>
  )
}
