'use client'

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked = false, onCheckedChange, disabled = false, className }, ref) => {
    return (
      <button
        ref={ref}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]",
          "disabled:cursor-not-allowed disabled:opacity-40",
          checked ? "bg-[var(--color-gold)]" : "bg-[var(--color-bg-elevated)] border border-[var(--color-border-base)]",
          className
        )}
      >
        <span
          className={cn(
            "inline-block h-3.5 w-3.5 transform rounded-full transition-transform",
            checked ? "translate-x-5 bg-[var(--color-text-inverse)]" : "translate-x-0.5 bg-[var(--color-text-secondary)]"
          )}
        />
      </button>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };
