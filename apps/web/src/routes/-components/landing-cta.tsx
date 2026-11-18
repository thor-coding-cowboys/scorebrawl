import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type LandingCtaSize = "sm" | "lg";
type LandingCtaVariant = "primary" | "quiet";

const BASE =
	"group inline-flex shrink-0 items-center justify-center gap-2 border font-mono font-semibold tracking-tight outline-none transition-[filter,background-color,color] duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const SIZES: Record<LandingCtaSize, string> = {
	sm: "min-h-11 px-4 text-base",
	lg: "min-h-12 px-6 text-base sm:min-h-14 sm:px-8 sm:text-lg",
};

const VARIANTS: Record<LandingCtaVariant, string> = {
	primary:
		"border-[var(--glow-blue-border)] bg-[var(--glow-blue-background)] text-[var(--glow-blue-text)] hover:brightness-125 active:brightness-100",
	quiet:
		"border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:underline hover:underline-offset-4",
};

export function LandingCta({
	href,
	children,
	className,
	size = "lg",
	variant = "primary",
	external = false,
	ariaLabel,
}: {
	href: string;
	children: ReactNode;
	className?: string;
	size?: LandingCtaSize;
	variant?: LandingCtaVariant;
	external?: boolean;
	ariaLabel?: string;
}) {
	return (
		<a
			href={href}
			aria-label={ariaLabel}
			className={cn(BASE, SIZES[size], VARIANTS[variant], className)}
			{...(external ? { target: "_blank", rel: "noreferrer" } : {})}
		>
			{children}
		</a>
	);
}
