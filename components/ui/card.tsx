import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

// ============================================================================
// CARD VARIANTS
// ============================================================================

const cardVariants = cva(
  "rounded-md transition-colors",
  {
    variants: {
      variant: {
        default: "bg-helm-surface border border-helm-border-base",
        elevated: "bg-helm-elevated border border-helm-border-base shadow-sm",
        glass: "bg-helm-surface/50 border border-helm-border-subtle backdrop-blur-sm",
        outline: "border border-helm-border-strong bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

// ============================================================================
// CARD
// ============================================================================

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

// ============================================================================
// CARD HEADER
// ============================================================================

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-2 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

// ============================================================================
// CARD TITLE
// ============================================================================

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("type-h3", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

// ============================================================================
// CARD DESCRIPTION
// ============================================================================

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("type-body text-helm-secondary", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

// ============================================================================
// CARD CONTENT
// ============================================================================

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

// ============================================================================
// CARD FOOTER
// ============================================================================

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
