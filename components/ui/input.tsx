import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-xl border border-line bg-ink-850/80 px-4 text-sm text-txt placeholder:text-txt-faint",
        "transition-colors duration-200 outline-none",
        "hover:border-line-strong focus:border-primary-400/70 focus:bg-ink-850 focus:ring-2 focus:ring-primary-500/25",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
