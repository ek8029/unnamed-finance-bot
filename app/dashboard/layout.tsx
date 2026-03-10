'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  TrendingUp,
  FileText,
  Settings,
  LogOut,
  Loader2,
  User,
  ChevronDown,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HelmMark } from '@/components/helm-mark';
import { useSettings } from '@/contexts/settings-context';
import { LegalFooter } from '@/components/legal-footer';

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Actions', href: '/dashboard/actions', icon: Zap },
  { name: 'Accounts', href: '/dashboard/accounts', icon: Wallet },
  { name: 'Transactions', href: '/dashboard/transactions', icon: ArrowLeftRight },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col">
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
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center space-x-3 px-3 py-1.5 rounded-lg hover:bg-[var(--color-bg-overlay)] transition-colors duration-200"
              >
                <div className="w-8 h-8 rounded-full bg-[var(--color-gold-surface)] border border-[var(--color-gold-border)] flex items-center justify-center">
                  <span className="text-xs font-semibold text-[var(--color-gold)]">
                    {profile?.initials || '...'}
                  </span>
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] leading-tight">
                    {profile?.fullName || 'Loading...'}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] leading-tight">
                    {profile?.email || ''}
                  </p>
                </div>
                <ChevronDown className={cn(
                  'w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200',
                  menuOpen && 'rotate-180'
                )} />
              </button>

              {/* Dropdown Menu */}
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-[var(--color-bg-surface)] border border-[var(--color-border-base)] rounded-xl shadow-xl z-50 overflow-hidden">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-[var(--color-border-base)]">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {profile?.fullName || 'User'}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">
                      {profile?.email || ''}
                    </p>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center space-x-3 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors"
                    >
                      <User className="w-4 h-4" />
                      <span>Account Settings</span>
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center space-x-3 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      <span>Preferences</span>
                    </Link>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-[var(--color-border-base)] py-1">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        handleLogout();
                      }}
                      disabled={loggingOut}
                      className="flex items-center space-x-3 w-full px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors disabled:opacity-50"
                    >
                      {loggingOut ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <LogOut className="w-4 h-4" />
                      )}
                      <span>{loggingOut ? 'Signing out...' : 'Sign out'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="bg-[var(--color-bg-base)] flex-1">
        <div
          key={pathname}
          className={cn(!reduceMotion && 'page-transition')}
        >
          {children}
        </div>
      </main>

      {/* Legal Footer */}
      <LegalFooter variant="minimal" />
    </div>
  );
}
