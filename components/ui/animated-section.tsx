'use client';

import { useScrollReveal } from '@/hooks/use-scroll-reveal';
import { cn } from '@/lib/utils';

interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'scale';
}

export function AnimatedSection({
  children,
  className,
  delay = 0,
  direction = 'up',
}: AnimatedSectionProps) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();

  const directionStyles = {
    up: 'translate-y-6',
    down: '-translate-y-6',
    left: 'translate-x-6',
    right: '-translate-x-6',
    scale: 'scale-[0.97]',
  };

  return (
    <div
      ref={ref}
      className={cn(
        'transition-[opacity,transform,filter] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
        isVisible
          ? 'opacity-100 translate-y-0 translate-x-0 scale-100'
          : `opacity-0 ${directionStyles[direction]}`,
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
