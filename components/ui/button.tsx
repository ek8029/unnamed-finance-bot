import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-gold)] text-[var(--color-text-inverse)] hover:bg-[var(--color-gold-hi)] shadow-sm font-semibold",
        destructive: "bg-[var(--color-negative)] text-white hover:opacity-90 shadow-sm font-semibold",
        outline: "border border-[var(--color-border-base)] bg-transparent hover:bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-strong)] text-[var(--color-text-primary)]",
        secondary: "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)] border border-[var(--color-border-base)] hover:border-[var(--color-border-strong)]",
        ghost: "hover:bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
        link: "text-[var(--color-gold)] underline-offset-4 hover:underline hover:text-[var(--color-gold-hi)]",
      },
      size: {
        default: "h-9 px-4 py-2 text-sm",
        sm: "h-8 rounded-sm px-3 text-xs",
        lg: "h-11 rounded-md px-8 text-sm",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
