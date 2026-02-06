"use client"

import { cn } from "@/lib/utils"

/**
 * Get the asset URL for user/organization images
 * Converts asset keys to proper authenticated URLs
 */
function getAssetUrl(assetKey: string | null | undefined): string | undefined {
	if (!assetKey || assetKey === "null") return undefined
	if (assetKey.startsWith("http")) return assetKey
	return `/api/user-assets/${assetKey}`
}

/**
 * Generate initials from a name
 * Takes the first letter of each word, up to 2 letters
 */
function getInitials(name?: string | null): string {
	if (!name) return "?"
	return name
		.split(" ")
		.map((word) => word[0]?.toUpperCase())
		.filter(Boolean)
		.slice(0, 2)
		.join("")
}

/**
 * Generate consistent color classes for a given name
 * Returns background, text, and border color classes that will always be the same for the same name
 */
function getNameColor(name?: string | null): string {
	if (!name) return "bg-gray-500/10 text-gray-600 border-gray-500/20"
	
	// Normalize the name: trim whitespace, convert to lowercase, remove extra spaces
	const normalizedName = name.trim().toLowerCase().replace(/\s+/g, ' ')
	
	// Create a simple hash from the normalized name using a better hash function
	let hash = 0
	for (let i = 0; i < normalizedName.length; i++) {
		const char = normalizedName.charCodeAt(i)
		hash = ((hash << 5) - hash) + char
		hash = hash & hash // Convert to 32-bit integer
	}
	
	// Make hash positive
	hash = Math.abs(hash)
	
	// Define color options following the existing palette pattern with borders
	const colors = [
		"bg-emerald-500/10 text-emerald-600 border-emerald-500/20",    // Green
		"bg-blue-500/10 text-blue-600 border-blue-500/20",            // Blue  
		"bg-amber-500/10 text-amber-600 border-amber-500/20",          // Amber
		"bg-purple-500/10 text-purple-600 border-purple-500/20",      // Purple
		"bg-rose-500/10 text-rose-600 border-rose-500/20",            // Rose
		"bg-cyan-500/10 text-cyan-600 border-cyan-500/20",            // Cyan
		"bg-orange-500/10 text-orange-600 border-orange-500/20",      // Orange
		"bg-indigo-500/10 text-indigo-600 border-indigo-500/20",      // Indigo
		"bg-pink-500/10 text-pink-600 border-pink-500/20",            // Pink
		"bg-teal-500/10 text-teal-600 border-teal-500/20",            // Teal
		"bg-lime-500/10 text-lime-600 border-lime-500/20",            // Lime
		"bg-violet-500/10 text-violet-600 border-violet-500/20",      // Violet
	]
	
	// Use modulo to select a color consistently
	const colorIndex = hash % colors.length
	return colors[colorIndex] ?? "bg-gray-500/10 text-gray-600 border-gray-500/20"
}

interface AvatarWithFallbackProps {
	/**
	 * Asset key or URL for the image
	 */
	src?: string | null
	/**
	 * Name for generating fallback initials
	 */
	name?: string | null
	/**
	 * Alt text for the image
	 */
	alt?: string
	/**
	 * Size of the avatar
	 * @default "md"
	 */
	size?: "sm" | "md" | "lg" | "xl"
	/**
	 * Additional CSS classes
	 */
	className?: string

}

const sizeMap = {
	sm: "size-6",
	md: "size-8", 
	lg: "size-10",
	xl: "size-16",
} as const

const textSizeMap = {
	sm: "text-xs",
	md: "text-sm",
	lg: "text-sm", 
	xl: "text-lg",
} as const

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
}: AvatarWithFallbackProps) {
	const imageUrl = getAssetUrl(src)
	const initials = getInitials(name)
	const displayAlt = alt || name || "Avatar"
	const nameColorClasses = getNameColor(name)

	return (
		<div
			className={cn(
				"relative flex shrink-0 select-none items-center justify-center rounded-lg overflow-hidden border",
				sizeMap[size],
				// Use name-based colors when no image, fallback to muted when image exists
				!imageUrl ? nameColorClasses : "bg-muted border-border",
				className
			)}
		>
			{imageUrl ? (
				<img
					src={imageUrl}
					alt={displayAlt}
					className="size-full object-cover"
					onError={(e) => {
						// Hide broken images and show fallback with name colors
						const target = e.currentTarget
						target.style.display = "none"
						// Update parent background to use name colors when image fails
						const parent = target.parentElement
						if (parent) {
							parent.className = parent.className
								.replace("bg-muted", "")
								.concat(` ${nameColorClasses}`)
						}
					}}
				/>
			) : null}
			
			{/* Fallback initials - always rendered but hidden if image loads */}
			<div
				className={cn(
					"absolute inset-0 flex items-center justify-center font-medium",
					textSizeMap[size],
					imageUrl && "opacity-0", // Hidden when image is available
					// Use consistent colors for text - extract text color from nameColorClasses
					!imageUrl && nameColorClasses.includes("text-") 
						? nameColorClasses.split(" ").find(cls => cls.startsWith("text-"))
						: "text-muted-foreground"
				)}
			>
				{initials}
			</div>
		</div>
	)
}