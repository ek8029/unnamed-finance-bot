'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  TrendingUp,
  FileText,
  Settings,
  LogOut,
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { settings } = useSettings();
  const reduceMotion = settings.accessibility.reduceMotion;

  return (
    <div className="min-h-screen bg-helm-base">
      {/* Top Navigation Bar */}
      <nav className="bg-helm-surface border-b border-[rgba(255,255,255,0.06)] sticky top-0 z-50">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-4 group">
              <HelmMark size={40} className="transition-transform group-hover:scale-110" />
              <div>
                <span className="type-h2 text-sm tracking-tight text-helm-platinum">
                  Helm
                </span>
                <div className="type-caption text-helm-secondary">Intelligence</div>
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
                      'flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-150',
                      isActive
                        ? 'text-helm-gold bg-helm-overlay border border-helm-gold-border shadow-sm'
                        : 'text-helm-secondary hover:text-helm-platinum hover:bg-helm-overlay border border-transparent hover:border-helm-border-base'
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
                <p className="text-sm font-medium text-helm-platinum">John Doe</p>
                <p className="type-caption text-helm-secondary">Premium</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-[rgba(184,145,74,0.08)] border border-[rgba(184,145,74,0.18)] flex items-center justify-center">
                <span className="text-xs font-semibold text-helm-gold">JD</span>
              </div>
              <button className="p-2 text-helm-secondary hover:text-helm-platinum transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="bg-helm-base">
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
