import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md type-label font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-helm-gold focus-visible:ring-offset-2 focus-visible:ring-offset-helm-base disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-helm-gold text-helm-inverse hover:bg-helm-gold-hi shadow-sm",
        destructive: "bg-helm-negative text-helm-inverse hover:bg-helm-negative/80 shadow-sm",
        outline: "border border-helm-border-strong bg-transparent hover:bg-helm-overlay hover:border-helm-border-strong text-helm-platinum",
        secondary: "bg-helm-elevated text-helm-platinum hover:bg-helm-overlay border border-helm-border-base",
        ghost: "hover:bg-helm-overlay text-helm-platinum",
        link: "text-helm-gold underline-offset-4 hover:underline hover:text-helm-gold-hi",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-sm px-3 text-xs",
        lg: "h-11 rounded-md px-8",
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
