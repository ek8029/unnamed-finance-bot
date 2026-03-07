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
          "bg-helm-elevated border border-helm-border-base",
          "px-3 py-2 type-body",
          "text-helm-platinum placeholder:text-helm-muted",
          "transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-helm-gold focus-visible:ring-offset-2 focus-visible:ring-offset-helm-base",
          "focus-visible:border-helm-gold",
          "disabled:cursor-not-allowed disabled:opacity-40",
          "hover:border-helm-border-strong",
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
