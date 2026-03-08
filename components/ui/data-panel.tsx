import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

// ============================================================================
// DATA PANEL VARIANTS - Professional analytical display component
// ============================================================================

const dataPanelVariants = cva(
  'rounded-md border transition-all duration-150',
  {
    variants: {
      variant: {
        // Single key metric displays
        metric: 'bg-helm-surface border-helm-border-base hover:border-helm-border-strong',
        // Data tables and grids
        grid: 'bg-helm-surface border-helm-border-base',
        // Visualization containers
        chart: 'bg-helm-surface border-helm-border-base hover:border-helm-border-strong',
        // List-based content (insights, feeds)
        feed: 'bg-helm-surface border-helm-border-base',
      },
      elevation: {
        none: '',
        hover: 'hover:shadow-sm hover:-translate-y-px',
      },
    },
    defaultVariants: {
      variant: 'metric',
      elevation: 'none',
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
  ({ className, variant, elevation, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(dataPanelVariants({ variant, elevation }), className)}
      {...props}
    />
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
    className={cn('flex flex-col space-y-1 p-4 pb-3', className)}
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
    className={cn('type-h3 text-helm-platinum', className)}
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
    className={cn('type-label text-helm-secondary', className)}
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
  <div ref={ref} className={cn('p-4 pt-0', className)} {...props} />
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
    className={cn('flex items-center p-4 pt-0', className)}
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
