import type { ReactNode } from "react"
import type { VariantProps } from "class-variance-authority"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"

import { cn } from "@/lib/utils"
import type { buttonVariants } from "./button"

export interface GlowButtonProps extends VariantProps<typeof buttonVariants> {
  icon?: IconSvgElement
  glowColor?: { background: string; text: string; border: string } | string
  iconClassName?: string
  className?: string
  children?: ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: "button" | "submit" | "reset"
}

export function GlowButton({
  icon,
  glowColor,
  iconClassName,
  className,
  children,
  variant = "default",
  size = "default",
  type = "button",
  disabled,
  onClick,
  ...props
}: GlowButtonProps) {
  // Use purple as default glow color for default variant
  const finalGlowColor = glowColor || glowColors.purple

  // Handle both old string format and new object format
  const backgroundClass = typeof finalGlowColor === 'string' ? finalGlowColor : finalGlowColor.background
  const textClass = typeof finalGlowColor === 'string' ? 'text-foreground' : finalGlowColor.text
  const borderClass = typeof finalGlowColor === 'string' ? 'border-foreground/10' : finalGlowColor.border

  // With glow effect - create a button with filled background like status badges
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        // Base button styles from buttonVariants
        "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-none border bg-clip-padding text-xs font-medium focus-visible:ring-1 aria-invalid:ring-1 [&_svg:not([class*='size-'])]:size-4 inline-flex items-center justify-center whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none group/button select-none",
        // Size styles
        size === "sm" && "h-7 gap-1 rounded-none px-2.5 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        size === "default" && "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        size === "lg" && "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        // Badge-like styling with filled background effect
        backgroundClass,
        textClass,
        borderClass,
        // Hover effect
        "hover:opacity-80",
        className
      )}
      {...props}
    >
      {icon && (
        <HugeiconsIcon
          icon={icon}
          className={cn("size-4", iconClassName)}
        />
      )}
      {children}
    </button>
  )
}

// Predefined glow colors matching the status badge patterns with filled backgrounds
// Includes dark mode variants for better contrast
export const glowColors = {
  red: {
    background: "bg-red-500/10 dark:bg-red-600/20",
    text: "text-red-600 dark:text-red-300",
    border: "border-red-500/20 dark:border-red-600/30"
  },
  blue: {
    background: "bg-blue-500/10 dark:bg-blue-600/20",
    text: "text-blue-600 dark:text-blue-300", 
    border: "border-blue-500/20 dark:border-blue-600/30"
  },
  emerald: {
    background: "bg-emerald-500/10 dark:bg-emerald-600/20",
    text: "text-emerald-600 dark:text-emerald-300",
    border: "border-emerald-500/20 dark:border-emerald-600/30"
  },
  amber: {
    background: "bg-amber-500/10 dark:bg-amber-600/20",
    text: "text-amber-600 dark:text-amber-300",
    border: "border-amber-500/20 dark:border-amber-600/30"
  },
  purple: {
    background: "bg-purple-500/10 dark:bg-purple-600/20",
    text: "text-purple-600 dark:text-purple-300",
    border: "border-purple-500/20 dark:border-purple-600/30"
  },
  pink: {
    background: "bg-pink-500/10 dark:bg-pink-600/20",
    text: "text-pink-600 dark:text-pink-300",
    border: "border-pink-500/20 dark:border-pink-600/30"
  },
} as const