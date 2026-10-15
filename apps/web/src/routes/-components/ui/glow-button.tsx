import type { CSSProperties, ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";

import { cn } from "@/lib/utils";
import type { buttonVariants } from "./button";

export interface GlowButtonProps extends VariantProps<typeof buttonVariants> {
	icon?: IconSvgElement;
	glowColor?: { background: string; text: string; border: string } | string;
	iconClassName?: string;
	className?: string;
	style?: CSSProperties;
	children?: ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	type?: "button" | "submit" | "reset";
}

export function GlowButton({
	icon,
	glowColor,
	iconClassName,
	className,
	style,
	children,
	size = "default",
	type = "button",
	disabled,
	onClick,
	...props
}: GlowButtonProps) {
	const finalGlowColor = glowColor || glowColors.blue;

	// Handle both the object format and the legacy class-string format
	const backgroundColor =
		typeof finalGlowColor === "string" ? finalGlowColor : finalGlowColor.background;
	const color = typeof finalGlowColor === "string" ? "var(--foreground)" : finalGlowColor.text;
	const borderColor = typeof finalGlowColor === "string" ? "var(--border)" : finalGlowColor.border;

	// With glow effect - create a button with filled background like status badges
	return (
		<button
			type={type}
			disabled={disabled}
			onClick={onClick}
			style={{ backgroundColor, color, borderColor, ...style }}
			className={cn(
				// Base button styles from buttonVariants
				"focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-none border bg-clip-padding text-xs font-medium focus-visible:ring-1 aria-invalid:ring-1 [&_svg:not([class*='size-'])]:size-4 inline-flex items-center justify-center whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none group/button select-none",
				// Size styles
				size === "sm" &&
					"h-7 gap-1 rounded-none px-2.5 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
				size === "default" &&
					"h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
				size === "lg" &&
					"h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
				// Hover effect
				"hover:opacity-80",
				className
			)}
			{...props}
		>
			{icon && <HugeiconsIcon icon={icon} className={cn("size-4", iconClassName)} />}
			{children}
		</button>
	);
}

// Predefined glow colors sourced from packages/core/theme glow tones.
export const glowColors = {
	red: {
		background: "var(--glow-red-background)",
		text: "var(--glow-red-text)",
		border: "var(--glow-red-border)",
	},
	blue: {
		background: "var(--glow-blue-background)",
		text: "var(--glow-blue-text)",
		border: "var(--glow-blue-border)",
	},
	emerald: {
		background: "var(--glow-emerald-background)",
		text: "var(--glow-emerald-text)",
		border: "var(--glow-emerald-border)",
	},
	amber: {
		background: "var(--glow-amber-background)",
		text: "var(--glow-amber-text)",
		border: "var(--glow-amber-border)",
	},
	purple: {
		background: "var(--glow-purple-background)",
		text: "var(--glow-purple-text)",
		border: "var(--glow-purple-border)",
	},
	pink: {
		background: "var(--glow-pink-background)",
		text: "var(--glow-pink-text)",
		border: "var(--glow-pink-border)",
	},
} as const;
