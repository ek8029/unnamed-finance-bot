import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2 py-0.5 type-caption font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-helm-border-base bg-helm-elevated text-helm-platinum",
        secondary:
          "border-helm-border-subtle bg-helm-surface text-helm-secondary",
        destructive:
          "border-transparent bg-helm-negative/10 text-helm-negative border-helm-negative/20",
        outline: "border-helm-border-strong bg-transparent text-helm-platinum",
        success:
          "border-transparent bg-helm-positive/10 text-helm-positive border-helm-positive/20",
        warning:
          "border-transparent bg-helm-warning/10 text-helm-warning border-helm-warning/20",
        gold:
          "border-helm-gold-border bg-helm-gold-surface text-helm-gold",
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
