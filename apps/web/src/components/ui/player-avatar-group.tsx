import { cn } from "@/lib/utils";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Skeleton } from "@/components/ui/skeleton";

interface Player {
	id: string;
	name: string;
	image?: string | null;
}

type AvatarSize = "sm" | "md" | "lg" | "xl";

const overflowSizeMap = {
	sm: "size-6 text-[10px]",
	md: "size-8 text-xs",
	lg: "size-10 text-xs",
	xl: "size-16 text-sm",
} as const;

interface PlayerAvatarGroupInlineProps {
	players: Player[];
	size?: AvatarSize;
	max?: number;
	isLoading?: boolean;
	skeletonCount?: number;
	className?: string;
}

export function PlayerAvatarGroupInline({
	players,
	size = "lg",
	max = 4,
	isLoading,
	skeletonCount = 3,
	className,
}: PlayerAvatarGroupInlineProps) {
	if (isLoading) {
		return (
			<div className={cn("flex gap-2", className)}>
				{Array.from({ length: skeletonCount }).map((_, i) => (
					<Skeleton key={`avatar-skeleton-${String(i)}`} className={cn("rounded-lg", overflowSizeMap[size])} />
				))}
			</div>
		);
	}

	if (!players.length) return null;

	const visible = players.slice(0, max);
	const overflowCount = players.length - max;

	return (
		<div className={cn("flex gap-2", className)}>
			{visible.map((player) => (
				<AvatarWithFallback key={player.id} src={player.image} name={player.name} alt={player.name} size={size} />
			))}
			{overflowCount > 0 && (
				<div
					className={cn(
						"flex shrink-0 items-center justify-center rounded-lg border border-border bg-muted font-medium text-muted-foreground",
						overflowSizeMap[size],
					)}
				>
					+{overflowCount}
				</div>
			)}
		</div>
	);
}

interface PlayerAvatarGroupGridProps {
	players: Player[];
	size?: AvatarSize;
	isLoading?: boolean;
	skeletonCount?: number;
	className?: string;
}

const nameSizeMap = {
	sm: "text-xs",
	md: "text-xs",
	lg: "text-sm",
	xl: "text-sm font-medium",
} as const;

export function PlayerAvatarGroupGrid({
	players,
	size = "xl",
	isLoading,
	skeletonCount = 4,
	className,
}: PlayerAvatarGroupGridProps) {
	if (isLoading) {
		return (
			<div className={cn("grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4", className)}>
				{Array.from({ length: skeletonCount }).map((_, i) => (
					<div key={`player-skeleton-${String(i)}`} className="flex flex-col items-center space-y-2">
						<Skeleton className={cn("rounded-lg", overflowSizeMap[size])} />
						<Skeleton className="h-4 w-20" />
					</div>
				))}
			</div>
		);
	}

	if (!players.length) return null;

	return (
		<div className={cn("grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4", className)}>
			{players.map((player) => (
				<div key={player.id} className="flex flex-col items-center space-y-2">
					<AvatarWithFallback src={player.image} name={player.name} alt={player.name} size={size} />
					<p className={cn("text-center", nameSizeMap[size])}>{player.name}</p>
				</div>
			))}
		</div>
	);
}
