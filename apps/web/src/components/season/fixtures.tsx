import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { useState } from "react";

interface FixturesProps {
	slug: string;
	seasonSlug: string;
}

interface Fixture {
	id: string;
	seasonId: string;
	round: number;
	matchId: string | null;
	homePlayerId: string;
	awayPlayerId: string;
	homePlayerName?: string;
	awayPlayerName?: string;
	homePlayerImage?: string | null;
	awayPlayerImage?: string | null;
}

export function Fixtures({ slug, seasonSlug }: FixturesProps) {
	const { data: fixtures, isLoading } = useQuery<Fixture[]>({
		queryKey: ["season", "fixtures", slug, seasonSlug],
		queryFn: async () => {
			return await trpcClient.season.getFixtures.query({ seasonSlug });
		},
	});

	const { data: players } = useQuery({
		queryKey: ["seasonPlayer", "all", slug, seasonSlug],
		queryFn: async () => {
			return await trpcClient.seasonPlayer.getAll.query({ seasonSlug });
		},
	});

	const [showAll, setShowAll] = useState(false);

	if (isLoading) {
		return <Skeleton className="w-full h-80" />;
	}

	if (!fixtures?.length) {
		return (
			<div className="flex items-center justify-center h-40 text-muted-foreground">
				No fixtures scheduled
			</div>
		);
	}

	// Group fixtures by round
	const fixturesByRound = fixtures.reduce<Record<number, Fixture[]>>((acc, fixture) => {
		if (!acc[fixture.round]) {
			acc[fixture.round] = [];
		}

		// Enrich with player data
		const homePlayer = players?.find((p) => p.id === fixture.homePlayerId);
		const awayPlayer = players?.find((p) => p.id === fixture.awayPlayerId);

		acc[fixture.round].push({
			...fixture,
			homePlayerName: homePlayer?.name ?? "Unknown",
			awayPlayerName: awayPlayer?.name ?? "Unknown",
			homePlayerImage: homePlayer?.image,
			awayPlayerImage: awayPlayer?.image,
		});
		return acc;
	}, {});

	const rounds = Object.keys(fixturesByRound)
		.map(Number)
		.sort((a, b) => a - b);

	// Find the current round (first round with unplayed matches)
	const currentRoundIndex = rounds.findIndex((round) =>
		fixturesByRound[round].some((f) => !f.matchId)
	);
	const currentRound =
		currentRoundIndex >= 0 ? rounds[currentRoundIndex] : rounds[rounds.length - 1];

	// Show current round and optionally all rounds
	const roundsToShow = showAll ? rounds : [currentRound];

	return (
		<div className="space-y-6">
			{roundsToShow.map((round) => (
				<div key={round} className="space-y-3">
					<div className="flex items-center gap-2">
						<h3 className="text-sm font-medium">Round {round}</h3>
						{round === currentRound && (
							<span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
								Current
							</span>
						)}
					</div>
					<div className="space-y-2">
						{fixturesByRound[round].map((fixture) => (
							<div
								key={fixture.id}
								className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
							>
								<div className="flex items-center gap-3 flex-1">
									<div className="flex items-center gap-2 flex-1">
										<AvatarWithFallback
											src={fixture.homePlayerImage}
											name={fixture.homePlayerName}
											size="sm"
										/>
										<span className="text-sm truncate">{fixture.homePlayerName}</span>
									</div>
									<span className="text-xs text-muted-foreground px-2">vs</span>
									<div className="flex items-center gap-2 flex-1 justify-end">
										<span className="text-sm truncate">{fixture.awayPlayerName}</span>
										<AvatarWithFallback
											src={fixture.awayPlayerImage}
											name={fixture.awayPlayerName}
											size="sm"
										/>
									</div>
								</div>
								{fixture.matchId ? (
									<span className="text-xs text-green-600 ml-2">Played</span>
								) : (
									<span className="text-xs text-muted-foreground ml-2">Pending</span>
								)}
							</div>
						))}
					</div>
				</div>
			))}

			{!showAll && rounds.length > 1 && (
				<Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAll(true)}>
					Show all {rounds.length} rounds
				</Button>
			)}
		</div>
	);
}
