import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2 py-0.5 type-caption font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-[var(--color-border-base)] bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]",
        secondary:
          "border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]",
        destructive:
          "border-[var(--color-negative)]/20 bg-[var(--color-negative)]/10 text-[var(--color-negative)]",
        outline: "border-[var(--color-border-strong)] bg-transparent text-[var(--color-text-primary)]",
        success:
          "border-[var(--color-positive)]/20 bg-[var(--color-positive)]/10 text-[var(--color-positive)]",
        warning:
          "border-[var(--color-warning)]/20 bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
        gold:
          "border-[var(--color-gold-border)] bg-[var(--color-gold-surface)] text-[var(--color-gold)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
