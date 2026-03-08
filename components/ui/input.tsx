import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md",
          "bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)]",
          "px-3 py-2 type-body",
          "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
          "transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]",
          "focus-visible:border-[var(--color-gold)]",
          "disabled:cursor-not-allowed disabled:opacity-40",
          "hover:border-[var(--color-border-strong)]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
