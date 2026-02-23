import { cn } from "@/lib/utils";
import { glowColors } from "./glow-button";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle02Icon, CircleIcon } from "@hugeicons/core-free-icons";

export interface GlowToggleProps {
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	label: string;
	glowColor?: keyof typeof glowColors;
	className?: string;
	disabled?: boolean;
}

export function GlowToggle({
	checked,
	onCheckedChange,
	label,
	glowColor = "blue",
	className,
	disabled,
}: GlowToggleProps) {
	const colors = glowColors[glowColor];

	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			disabled={disabled}
			onClick={() => onCheckedChange(!checked)}
			className={cn(
				"inline-flex items-center gap-1.5 rounded-none border px-2.5 h-7 text-xs font-medium transition-all select-none",
				"focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:border-ring outline-none",
				"disabled:pointer-events-none disabled:opacity-50",
				checked
					? cn(colors.background, colors.text, colors.border)
					: "bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-foreground/20",
				className
			)}
		>
			<HugeiconsIcon
				icon={checked ? CheckmarkCircle02Icon : CircleIcon}
				className="size-3.5"
				fill={checked ? "currentColor" : "none"}
			/>
			{label}
		</button>
	);
}
