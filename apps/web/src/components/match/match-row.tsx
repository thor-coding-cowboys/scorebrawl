import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "@/lib/trpc";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserMultipleIcon } from "@hugeicons/core-free-icons";

const getAssetUrl = (key: string | null | undefined): string | null => {
	if (!key) return null;
	if (key.startsWith("http://") || key.startsWith("https://")) {
		return key;
	}
	return `/api/user-assets/${key}`;
};

function TeamIcon({ logo, name }: { logo: string | null; name: string }) {
	const [hasError, setHasError] = useState(false);
	const logoUrl = getAssetUrl(logo);

	if (!logoUrl || hasError) {
		return (
			<div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10">
				<HugeiconsIcon icon={UserMultipleIcon} className="size-4 text-blue-500" />
			</div>
		);
	}

	return (
		<div className="flex h-6 w-6 items-center justify-center rounded-lg overflow-hidden">
			<img
				src={logoUrl}
				alt={name}
				className="h-full w-full object-cover"
				onError={() => setHasError(true)}
			/>
		</div>
	);
}

interface MatchPlayer {
	id: string;
	seasonPlayerId: string;
	homeTeam: boolean;
	result: "W" | "L" | "D";
	scoreBefore: number;
	scoreAfter: number;
	name: string;
	image: string | null;
	teamName: string | null;
	teamLogo: string | null;
}

interface MatchRowProps {
	match: {
		id: string;
		homeScore: number;
		awayScore: number;
		createdAt: Date;
	};
	seasonSlug: string;
	seasonId: string;
}

function getTeamInfo(players: MatchPlayer[]): { name: string; logo: string | null } | null {
	if (players.length <= 1) return null;
	// Multiple players = always a team
	// Use the teamName/teamLogo from the first player (backend sets same value for all players on a side)
	const teamName = players[0]?.teamName;
	const teamLogo = players[0]?.teamLogo ?? null;
	if (teamName) {
		return { name: teamName, logo: teamLogo };
	}
	// Fallback: use player first names as team name
	const fallbackName = players.map((p) => p.name.split(" ")[0]).join(" & ");
	return { name: fallbackName, logo: teamLogo };
}

function getSideLabel(players: MatchPlayer[]): string {
	if (players.length === 0) return "Unknown";
	const teamInfo = getTeamInfo(players);
	if (teamInfo) {
		return teamInfo.name;
	}
	return players.map((p) => p.name).join(", ");
}

function formatDate(date: Date) {
	const now = new Date();
	const matchDate = new Date(date);

	const isToday =
		now.getFullYear() === matchDate.getFullYear() &&
		now.getMonth() === matchDate.getMonth() &&
		now.getDate() === matchDate.getDate();

	if (isToday) {
		const diffMs = now.getTime() - matchDate.getTime();
		const diffMinutes = Math.floor(diffMs / (1000 * 60));

		if (diffMinutes < 60) {
			return diffMinutes <= 1 ? "1m ago" : `${diffMinutes}m ago`;
		}
		const diffHours = Math.floor(diffMinutes / 60);
		return `${diffHours}h ago`;
	}
	return matchDate.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
}

function SideDisplay({ players, side }: { players: MatchPlayer[]; side: "home" | "away" }) {
	const teamInfo = getTeamInfo(players);

	return (
		<div className="flex items-center gap-2 min-w-0" data-testid={`match-${side}-side`}>
			<div className="flex gap-1 shrink-0">
				{teamInfo ? (
					<TeamIcon logo={teamInfo.logo} name={teamInfo.name} />
				) : (
					players.map((player) => (
						<AvatarWithFallback key={player.id} src={player.image} name={player.name} size="sm" />
					))
				)}
			</div>
			<span className="text-xs text-muted-foreground truncate">{getSideLabel(players)}</span>
		</div>
	);
}

export function MatchRow({ match, seasonSlug }: MatchRowProps) {
	const { data: matchDetails } = useQuery<{ players: MatchPlayer[] } | null>({
		queryKey: ["match", "details", match.id],
		queryFn: async () => {
			return await trpcClient.match.getById.query({ seasonSlug, matchId: match.id });
		},
		enabled: !!match.id,
	});

	const homePlayers = matchDetails?.players?.filter((p) => p.homeTeam) ?? [];
	const awayPlayers = matchDetails?.players?.filter((p) => !p.homeTeam) ?? [];

	return (
		<div
			className="flex items-center justify-between gap-4 p-4"
			data-testid={`match-row-${match.id}`}
		>
			<div className="flex flex-col gap-2 min-w-0 flex-1">
				<SideDisplay players={homePlayers} side="home" />
				<SideDisplay players={awayPlayers} side="away" />
			</div>
			<div className="flex items-center gap-4 flex-shrink-0">
				<div className="text-center font-bold text-sm" data-testid={`match-score-${match.id}`}>
					{match.homeScore} - {match.awayScore}
				</div>
				<div
					className="text-xs text-muted-foreground text-right min-w-[60px]"
					data-testid={`match-date-${match.id}`}
				>
					{formatDate(match.createdAt)}
				</div>
			</div>
		</div>
	);
}
