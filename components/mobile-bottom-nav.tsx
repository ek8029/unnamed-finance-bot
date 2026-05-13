'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, TrendingUp, Search, BookOpen, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'home', label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { id: 'port', label: 'Portfolio', href: '/dashboard/portfolio', icon: TrendingUp },
  { id: 'analyze', label: 'Analyze', href: '/dashboard/analyze', icon: Search, primary: true },
  { id: 'brief', label: 'Brief', href: '/dashboard/brief', icon: BookOpen },
  { id: 'inbox', label: 'Inbox', href: '/dashboard/actions', icon: Zap },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  const isActive = (tab: typeof tabs[number]) => {
    if (tab.href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(tab.href);
  };

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{
        background: 'rgba(10,10,10,0.78)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="grid grid-cols-5 pb-[env(safe-area-inset-bottom,8px)] pt-2">
        {tabs.map((tab) => {
          const active = isActive(tab);
          const Icon = tab.icon;

          if (tab.primary) {
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className="flex flex-col items-center justify-center gap-1 py-1"
              >
                <div
                  className="w-10 h-10 -mt-3 rounded-full flex items-center justify-center"
                  style={{
                    background: '#E6B94D',
                    boxShadow: '0 6px 14px rgba(230,185,77,0.35)',
                  }}
                >
                  <Icon className="w-5 h-5 text-black" strokeWidth={2.5} />
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className="flex flex-col items-center justify-center gap-1 py-1 relative"
            >
              <Icon
                className={cn(
                  'w-[18px] h-[18px] transition-colors',
                  active ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-muted)]'
                )}
              />
              <span
                className={cn(
                  'text-[10px] tracking-wide transition-colors',
                  active
                    ? 'text-[var(--color-gold)] font-bold'
                    : 'text-[var(--color-text-muted)] font-medium'
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
