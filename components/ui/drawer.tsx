'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useCallback } from 'react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const drawerSizes = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
};

export function Drawer({ isOpen, onClose, title, children, size = 'md' }: DrawerProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Focus trap
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !drawerRef.current) return;
    const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement as HTMLElement;
      const timer = setTimeout(() => {
        const closeBtn = drawerRef.current?.querySelector<HTMLElement>('button[aria-label="Close drawer"]');
        closeBtn?.focus();
      }, 100);
      document.addEventListener('keydown', trapFocus);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', trapFocus);
        previousFocus.current?.focus();
      };
    }
  }, [isOpen, trapFocus]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/60 backdrop-blur-sm z-40',
          'transition-opacity duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={cn(
          'fixed top-0 right-0 h-full w-full bg-[var(--color-bg-surface)] border-l border-[var(--color-border-base)] shadow-2xl z-50',
          'transform transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
          isOpen ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0',
          drawerSizes[size]
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Header */}
        <div className={cn(
          'sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-base)] bg-[var(--color-bg-surface)]',
          'transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] delay-100',
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        )}>
          <h2 id="drawer-title" className="type-h2 text-[var(--color-text-primary)]">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-[var(--color-bg-overlay)] transition-[color,background-color,transform] duration-200 ease-out text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:scale-110 active:scale-95"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className={cn(
          'h-[calc(100%-73px)] overflow-y-auto custom-scrollbar',
          'transition-[opacity,transform] duration-600 ease-[cubic-bezier(0.16,1,0.3,1)] delay-150',
          isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
        )}>
          {children}
        </div>
      </div>
    </>
  );
}

// Drawer Section Components
interface DrawerSectionProps {
  children: React.ReactNode;
  className?: string;
}

export function DrawerSection({ children, className }: DrawerSectionProps) {
  return (
    <div className={cn('px-6 py-4 border-b border-[var(--color-border-subtle)] last:border-b-0', className)}>
      {children}
    </div>
  );
}

interface DrawerSectionHeaderProps {
  children: React.ReactNode;
}

export function DrawerSectionHeader({ children }: DrawerSectionHeaderProps) {
  return <h3 className="type-h3 text-[var(--color-text-primary)] mb-3">{children}</h3>;
}
