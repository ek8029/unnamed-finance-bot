import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

// ============================================================================
// DATA PANEL VARIANTS - Professional analytical display component
// ============================================================================

const dataPanelVariants = cva(
  'rounded border relative overflow-hidden transition-[border-color,box-shadow,background-color] duration-200',
  {
    variants: {
      variant: {
        metric: 'sovereign-card',
        grid: 'sovereign-card',
        chart: 'sovereign-card',
        feed: 'sovereign-card',
      },
      accent: {
        none: '',
        brass: '',
      },
    },
    defaultVariants: {
      variant: 'metric',
      accent: 'none',
    },
  }
);

// ============================================================================
// DATA PANEL
// ============================================================================

export interface DataPanelProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof dataPanelVariants> {}

const DataPanel = React.forwardRef<HTMLDivElement, DataPanelProps>(
  ({ className, variant, accent, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(dataPanelVariants({ variant, accent }), className)}
      {...props}
    >
      {accent === 'brass' && (
        <>
          <div
            className="absolute top-0 left-0 right-0 h-[1px]"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(230,185,77,0.5), var(--color-gold), rgba(230,185,77,0.5), transparent)',
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 50% 30% at 50% 0%, rgba(230,185,77,0.04) 0%, transparent 60%)',
            }}
          />
        </>
      )}
      {children}
    </div>
  )
);
DataPanel.displayName = 'DataPanel';

// ============================================================================
// DATA PANEL HEADER - Compact header for professional displays
// ============================================================================

const DataPanelHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1 card-padding pb-2', className)}
    {...props}
  />
));
DataPanelHeader.displayName = 'DataPanelHeader';

// ============================================================================
// DATA PANEL TITLE
// ============================================================================

const DataPanelTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-[13px] uppercase tracking-widest text-[var(--color-text-muted)] font-mono', className)}
    {...props}
  />
));
DataPanelTitle.displayName = 'DataPanelTitle';

// ============================================================================
// DATA PANEL DESCRIPTION
// ============================================================================

const DataPanelDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('type-label text-[var(--color-text-secondary)]', className)}
    {...props}
  />
));
DataPanelDescription.displayName = 'DataPanelDescription';

// ============================================================================
// DATA PANEL CONTENT - Reduced padding for density
// ============================================================================

const DataPanelContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('card-padding pt-0', className)} {...props} />
));
DataPanelContent.displayName = 'DataPanelContent';

// ============================================================================
// DATA PANEL FOOTER
// ============================================================================

const DataPanelFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center card-padding pt-0', className)}
    {...props}
  />
));
DataPanelFooter.displayName = 'DataPanelFooter';

// ============================================================================
// EXPORTS
// ============================================================================

export {
  DataPanel,
  DataPanelHeader,
  DataPanelFooter,
  DataPanelTitle,
  DataPanelDescription,
  DataPanelContent,
};
