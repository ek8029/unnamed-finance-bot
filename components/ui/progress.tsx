import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  variant?: "default" | "positive" | "negative" | "warning" | "gold";
}

const variantStyles = {
  default: "bg-helm-platinum",
  positive: "bg-helm-positive",
  negative: "bg-helm-negative",
  warning: "bg-helm-warning",
  gold: "bg-helm-gold",
};

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, variant = "default", ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    return (
      <div
        ref={ref}
        className={cn(
          "relative h-1.5 w-full overflow-hidden rounded-full bg-helm-elevated border border-helm-border-subtle",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full w-full flex-1 transition-all duration-300",
            variantStyles[variant]
          )}
          style={{ transform: `translateX(-${100 - percentage}%)` }}
        />
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
