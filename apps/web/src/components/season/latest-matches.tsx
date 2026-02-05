import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { trpcClient } from "@/lib/trpc";
import { OverviewCard } from "./overview-card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";

interface LatestMatchesProps {
	slug: string;
	seasonSlug: string;
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
}

interface Match {
	id: string;
	seasonId: string;
	homeScore: number;
	awayScore: number;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
	homeExpectedElo: number | null;
	awayExpectedElo: number | null;
	createdBy: string;
	updatedBy: string;
}

interface MatchesData {
	matches: Match[];
	total: number;
}

export function LatestMatches({ slug, seasonSlug }: LatestMatchesProps) {
	const navigate = useNavigate();
	const { data, isLoading } = useQuery<MatchesData>({
		queryKey: ["match", "all", slug, seasonSlug],
		queryFn: async () => {
			return await trpcClient.match.getAll.query({ seasonSlug, limit: 8 });
		},
	});

	const showEmptyState = !isLoading && data && data.matches.length < 1;
	const showMatches = !isLoading && data && data.matches.length > 0;

	return (
		<OverviewCard title="Latest Matches">
			{isLoading ? (
				<Skeleton className="w-full h-40" />
			) : showMatches ? (
				<>
					<MatchTable matches={data.matches} seasonSlug={seasonSlug} />
					<div className="flex items-center justify-end space-x-2 pt-4">
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								navigate({
									to: "/leagues/$slug/seasons/$seasonSlug",
									params: { slug, seasonSlug },
								})
							}
						>
							Show all
						</Button>
					</div>
				</>
			) : showEmptyState ? (
				<div className="flex items-center justify-center h-40 text-muted-foreground">
					No registered matches
				</div>
			) : null}
		</OverviewCard>
	);
}

function MatchTable({ matches, seasonSlug }: { matches: Match[]; seasonSlug: string }) {
	return (
		<Table>
			<TableHeader className="text-xs">
				<TableRow>
					<TableHead>Match</TableHead>
					<TableHead className="text-center">Score</TableHead>
					<TableHead className="text-right">Date</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody className="text-sm">
				{matches.map((match) => (
					<MatchRow key={match.id} match={match} seasonSlug={seasonSlug} />
				))}
			</TableBody>
		</Table>
	);
}

function MatchRow({ match, seasonSlug }: { match: Match; seasonSlug: string }) {
	const { data: matchDetails } = useQuery<{ players: MatchPlayer[] } | null>({
		queryKey: ["match", "details", match.id],
		queryFn: async () => {
			return await trpcClient.match.getById.query({ seasonSlug, matchId: match.id });
		},
		enabled: !!match.id,
	});

	const homePlayers = matchDetails?.players?.filter((p) => p.homeTeam) ?? [];
	const awayPlayers = matchDetails?.players?.filter((p) => !p.homeTeam) ?? [];

	const formatDate = (date: Date) => {
		return new Date(date).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	};

	return (
		<TableRow>
			<TableCell>
				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-2">
						<div className="flex -space-x-2">
							{homePlayers.map((player) => (
								<AvatarWithFallback
									key={player.id}
									src={player.image}
									name={player.name}
									size="sm"
									className="border-2 border-background"
								/>
							))}
						</div>
						<span className="text-xs text-muted-foreground">
							{homePlayers.map((p) => p.name).join(", ") || "Unknown"}
						</span>
					</div>
					<div className="flex items-center gap-2">
						<div className="flex -space-x-2">
							{awayPlayers.map((player) => (
								<AvatarWithFallback
									key={player.id}
									src={player.image}
									name={player.name}
									size="sm"
									className="border-2 border-background"
								/>
							))}
						</div>
						<span className="text-xs text-muted-foreground">
							{awayPlayers.map((p) => p.name).join(", ") || "Unknown"}
						</span>
					</div>
				</div>
			</TableCell>
			<TableCell className="text-center font-bold">
				{match.homeScore} - {match.awayScore}
			</TableCell>
			<TableCell className="text-right text-xs text-muted-foreground">
				{formatDate(match.createdAt)}
			</TableCell>
		</TableRow>
	);
}
