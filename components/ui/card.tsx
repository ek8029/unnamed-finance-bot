import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

// ============================================================================
// CARD VARIANTS
// ============================================================================

const cardVariants = cva(
  "rounded-md transition-all duration-200",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-bg-surface)] border border-[var(--color-border-base)]",
        elevated: "bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)] shadow-sm",
        glass: "glass border border-[var(--color-border-subtle)]",
        outline: "border border-[var(--color-border-strong)] bg-transparent",
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
    className={cn("type-body text-[var(--color-text-secondary)]", className)}
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
