'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  FileText,
  Settings,
  LogOut,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HelmMark } from '@/components/helm-mark';
import { useSettings } from '@/contexts/settings-context';

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Accounts', href: '/dashboard/accounts', icon: Wallet },
  { name: 'Portfolio', href: '/dashboard/portfolio', icon: TrendingUp },
  { name: 'Taxes', href: '/dashboard/taxes', icon: FileText },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

interface UserProfile {
  fullName: string;
  email: string;
  initials: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { settings } = useSettings();
  const reduceMotion = settings.accessibility.reduceMotion;
  const [loggingOut, setLoggingOut] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Fetch user profile on mount
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/user/profile');
        if (res.ok) {
          const data = await res.json();
          const fullName = data.profile?.full_name || data.profile?.email?.split('@')[0] || 'User';
          const nameParts = fullName.split(' ');
          const initials = nameParts.length >= 2
            ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
            : fullName.slice(0, 2).toUpperCase();

          setProfile({
            fullName,
            email: data.profile?.email || '',
            initials,
          });
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      }
    }
    fetchProfile();
  }, []);

  // Handle logout
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/login');
        router.refresh();
      }
    } catch (error) {
      console.error('Logout failed:', error);
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)]">
      {/* Top Navigation Bar */}
      <nav className="bg-[var(--color-bg-surface)] border-b border-[var(--color-border-base)] sticky top-0 z-50">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Logo — bigger and more prominent */}
            <Link href="/" className="flex items-center gap-3 group">
              <HelmMark size={40} className="transition-transform duration-200 group-hover:scale-105" />
              <div>
                <span className="text-[17px] font-semibold tracking-tight text-[var(--color-text-primary)]">
                  Helm
                </span>
                <div className="type-eyebrow text-[var(--color-text-muted)]">Intelligence</div>
              </div>
            </Link>

            {/* Navigation Links */}
            <div className="flex items-center space-x-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
                      isActive
                        ? 'text-[var(--color-gold)] bg-[var(--color-bg-overlay)] border border-[var(--color-gold-border)]'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] border border-transparent hover:border-[var(--color-border-base)]'
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {profile?.fullName || 'Loading...'}
                </p>
                <p className="type-eyebrow text-[var(--color-text-muted)]">Premium</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center">
                <span className="text-xs font-semibold text-[var(--color-gold)]">
                  {profile?.initials || '...'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors duration-200 disabled:opacity-50"
                title="Sign out"
              >
                {loggingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="bg-[var(--color-bg-base)]">
        <div
          key={pathname}
          className={cn(!reduceMotion && 'page-transition')}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
