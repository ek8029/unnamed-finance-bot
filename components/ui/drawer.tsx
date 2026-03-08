'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

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

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-full bg-[var(--color-bg-surface)] border-l border-[var(--color-border-base)] shadow-2xl z-50',
          'transform transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
          drawerSizes[size]
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-base)] bg-[var(--color-bg-surface)]">
          <h2 id="drawer-title" className="type-h2 text-[var(--color-text-primary)]">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-[var(--color-bg-overlay)] transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-73px)] overflow-y-auto custom-scrollbar">
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
