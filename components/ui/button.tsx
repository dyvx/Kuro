import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
}

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-brand-gradient text-white shadow-glow-sm hover:shadow-glow hover:brightness-110 active:scale-[0.98]",
  secondary:
    "bg-surface-raised text-txt border border-line hover:border-line-strong hover:bg-surface-overlay active:scale-[0.98]",
  ghost: "text-txt-muted hover:text-txt hover:bg-white/5 active:scale-[0.98]",
  outline:
    "border border-line-strong text-txt hover:border-primary-400/60 hover:text-primary-200 hover:bg-primary-500/10 active:scale-[0.98]",
  danger:
    "bg-crimson-500/15 text-crimson-400 border border-crimson-500/30 hover:bg-crimson-500/25 active:scale-[0.98]",
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-[15px] gap-2.5",
  icon: "h-10 w-10",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center rounded-xl font-semibold transition-all duration-200 ease-premium",
        "disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
