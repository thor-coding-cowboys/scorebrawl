import { useState } from "react";
import { cn } from "@/lib/utils";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserMultipleIcon } from "@hugeicons/core-free-icons";

const getAssetUrl = (key: string | null | undefined): string | null => {
	if (!key) return null;
	if (key.startsWith("http://") || key.startsWith("https://")) return key;
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

export interface MatchDisplayPlayer {
	id: string;
	name: string;
	image: string | null;
	teamName: string | null;
	teamLogo: string | null;
	homeTeam: boolean;
}

function getTeamInfo(players: MatchDisplayPlayer[]): { name: string; logo: string | null } | null {
	if (players.length <= 1) return null;
	const teamName = players[0]?.teamName;
	const teamLogo = players[0]?.teamLogo ?? null;
	if (teamName) return { name: teamName, logo: teamLogo };
	return { name: players.map((p) => p.name.split(" ")[0]).join(" & "), logo: teamLogo };
}

function getSideLabel(players: MatchDisplayPlayer[]): string {
	if (players.length === 0) return "Unknown";
	const teamInfo = getTeamInfo(players);
	if (teamInfo) return teamInfo.name;
	return players.map((p) => p.name).join(", ");
}

function formatTimestamp(date: Date) {
	const now = new Date();
	const matchDate = new Date(date);
	const isToday = now.toDateString() === matchDate.toDateString();

	if (isToday) {
		const diffMs = now.getTime() - matchDate.getTime();
		const diffMinutes = Math.floor(diffMs / (1000 * 60));
		if (diffMinutes < 60) {
			return { primary: diffMinutes <= 1 ? "1m ago" : `${diffMinutes}m ago` };
		}
		return { primary: `${Math.floor(diffMinutes / 60)}h ago` };
	}

	return {
		primary: matchDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
		secondary: matchDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
	};
}

function ScoreLine({
	players,
	score,
	isWinner,
	isMuted,
	"data-testid": dataTestId,
}: {
	players: MatchDisplayPlayer[];
	score: number;
	isWinner: boolean;
	isMuted: boolean;
	"data-testid"?: string;
}) {
	const teamInfo = getTeamInfo(players);

	return (
		<div className="flex items-center justify-between gap-2 min-w-0 overflow-hidden">
			<div className="flex items-center gap-2 min-w-0 overflow-hidden">
				<div className="flex gap-1 shrink-0">
					{teamInfo ? (
						<TeamIcon logo={teamInfo.logo} name={teamInfo.name} />
					) : (
						players.map((player) => (
							<AvatarWithFallback key={player.id} src={player.image} name={player.name} size="sm" />
						))
					)}
				</div>
				<span
					className={cn(
						"text-sm truncate",
						isWinner && "font-semibold text-foreground",
						isMuted && "text-muted-foreground",
						!isWinner && !isMuted && "text-foreground"
					)}
				>
					{getSideLabel(players)}
				</span>
			</div>
			<span
				data-testid={dataTestId}
				className={cn(
					"text-base tabular-nums shrink-0",
					isWinner && "font-bold text-foreground",
					isMuted && "text-muted-foreground font-medium",
					!isWinner && !isMuted && "font-medium text-foreground"
				)}
			>
				{score}
			</span>
		</div>
	);
}

interface MatchScoreDisplayProps {
	matchId: string;
	homeScore: number;
	awayScore: number;
	createdAt: Date;
	homePlayers: MatchDisplayPlayer[];
	awayPlayers: MatchDisplayPlayer[];
	compact?: boolean;
}

export function MatchScoreDisplay({
	matchId,
	homeScore,
	awayScore,
	createdAt,
	homePlayers,
	awayPlayers,
	compact,
}: MatchScoreDisplayProps) {
	const homeWins = homeScore > awayScore;
	const awayWins = awayScore > homeScore;
	const timestamp = formatTimestamp(createdAt);

	if (compact) {
		return (
			<div className="flex flex-col min-w-0" data-testid={`match-row-${matchId}`}>
				<div className="flex flex-col gap-2 min-w-0">
					<ScoreLine
						players={homePlayers}
						score={homeScore}
						isWinner={homeWins}
						isMuted={awayWins}
					/>
					<ScoreLine
						players={awayPlayers}
						score={awayScore}
						isWinner={awayWins}
						isMuted={homeWins}
					/>
				</div>
				<div
					className="text-xs text-muted-foreground text-right mt-3 pt-3 border-t border-border"
					data-testid={`match-date-${matchId}`}
				>
					{timestamp.primary}
					{timestamp.secondary && ` · ${timestamp.secondary}`}
				</div>
			</div>
		);
	}

	return (
		<div className="flex items-center min-w-0 overflow-hidden" data-testid={`match-row-${matchId}`}>
			<div className="flex flex-col items-start shrink-0 w-16 md:w-20 mr-3 md:mr-4">
				<span className="text-xs text-muted-foreground" data-testid={`match-date-${matchId}`}>
					{timestamp.primary}
				</span>
				{timestamp.secondary && (
					<span className="hidden md:block text-[11px] text-muted-foreground/60">
						{timestamp.secondary}
					</span>
				)}
			</div>

			<div className="flex flex-col gap-2 min-w-0 flex-1">
				<ScoreLine
					players={homePlayers}
					score={homeScore}
					isWinner={homeWins}
					isMuted={awayWins}
					data-testid={`match-score-${matchId}-home`}
				/>
				<ScoreLine
					players={awayPlayers}
					score={awayScore}
					isWinner={awayWins}
					isMuted={homeWins}
					data-testid={`match-score-${matchId}-away`}
				/>
			</div>
		</div>
	);
}
