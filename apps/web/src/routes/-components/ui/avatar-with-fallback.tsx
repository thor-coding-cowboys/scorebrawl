"use client";

import { selectAvatarIndex } from "@coding-cowboys/scorebrawl-core/theme";

import { cn } from "@/lib/utils";

/**
 * Get the asset URL for user/organization images
 * Converts asset keys to proper authenticated URLs
 */
function getAssetUrl(assetKey: string | null | undefined): string | undefined {
	if (!assetKey || assetKey === "null") return undefined;
	if (assetKey.startsWith("http")) return assetKey;
	return `/api/user-assets/${assetKey}`;
}

/**
 * Generate initials from a name
 * Takes the first letter of each word, up to 2 letters
 */
function getInitials(name?: string | null): string {
	if (!name) return "?";
	return name
		.split(" ")
		.map((word) => word[0]?.toUpperCase())
		.filter(Boolean)
		.slice(0, 2)
		.join("");
}

/**
 * Background, ink and border for a name's avatar tone. Falls back to the
 * neutral surface when there is no name to hash.
 */
function nameTone(name?: string | null): { classes: string; style: React.CSSProperties } {
	const index = selectAvatarIndex(name ?? "");
	if (index < 0) {
		return {
			classes: "",
			style: {
				backgroundColor: "var(--divider)",
				color: "var(--muted-foreground)",
				borderColor: "var(--border)",
			},
		};
	}

	return {
		classes: "",
		style: {
			backgroundColor: `var(--avatar-${index}-background)`,
			color: `var(--avatar-${index}-text)`,
			borderColor: `var(--avatar-${index}-border)`,
		},
	};
}

interface AvatarWithFallbackProps {
	src?: string | null;
	name?: string | null;
	alt?: string;
	size?: "sm" | "md" | "lg" | "xl";
	className?: string;
	style?: React.CSSProperties;
}

const sizeMap = {
	sm: "size-6",
	md: "size-8",
	lg: "size-10",
	xl: "size-16",
} as const;

const textSizeMap = {
	sm: "text-xs",
	md: "text-sm",
	lg: "text-sm",
	xl: "text-lg",
} as const;

/**
 * Unified avatar component for users and organizations
 * Uses rounded rectangular styling for consistency
 * Automatically handles asset URL conversion and fallback initials
 */
export function AvatarWithFallback({
	src,
	name,
	alt,
	size = "md",
	className,
	style,
}: AvatarWithFallbackProps) {
	const imageUrl = getAssetUrl(src);
	const initials = getInitials(name);
	const displayAlt = alt || name || "Avatar";
	const tone = nameTone(name);

	return (
		<div
			className={cn(
				"relative flex shrink-0 select-none items-center justify-center rounded-lg overflow-hidden border",
				sizeMap[size],
				!imageUrl ? tone.classes : "bg-muted border-border",
				className
			)}
			style={{ ...(imageUrl ? undefined : tone.style), ...style }}
		>
			{imageUrl ? (
				<img
					src={imageUrl}
					alt={displayAlt}
					className="size-full object-cover"
					onError={(e) => {
						// Hide broken images and show fallback with name colors
						const target = e.currentTarget;
						target.style.display = "none";
						// Update parent background to use name colors when image fails
						const parent = target.parentElement;
						if (parent) {
							parent.classList.remove("bg-muted");
							Object.assign(parent.style, tone.style);
						}
					}}
				/>
			) : null}

			{/* Fallback initials - always rendered but hidden if image loads */}
			<div
				className={cn(
					"absolute inset-0 flex items-center justify-center font-medium",
					textSizeMap[size],
					imageUrl && "opacity-0" // Hidden when image is available
				)}
			>
				{initials}
			</div>
		</div>
	);
}
