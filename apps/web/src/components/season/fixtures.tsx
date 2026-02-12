import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpcClient, useTRPC } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
	Add01Icon,
	Cancel01Icon,
	Loading03Icon,
	MinusSignIcon,
	PencilEdit01Icon,
	Tick01Icon,
} from "hugeicons-react";
import { toast } from "sonner";

interface FixturesProps {
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
	homeScore?: number | null;
	awayScore?: number | null;
}

const ScoreStepper = ({
	score = 0,
	setScore,
}: {
	score: number;
	setScore: (score: number) => void;
}) => {
	return (
		<div className="flex items-center gap-1">
			<Button
				variant="ghost"
				size="icon"
				className="h-7 w-7 shrink-0 rounded-full transition-transform active:scale-75"
				onClick={() => setScore(Math.max(score - 1, 0))}
				type="button"
			>
				<MinusSignIcon className="h-3.5 w-3.5" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				className="h-7 w-7 shrink-0 rounded-full transition-transform active:scale-75"
				onClick={() => setScore(score + 1)}
				type="button"
			>
				<Add01Icon className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
};

const FixtureRow = ({ fixture, seasonSlug }: { fixture: Fixture; seasonSlug: string }) => {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showMatchCreate, setShowMatchCreate] = useState(false);
	const [homeScore, setHomeScore] = useState<number | null>(null);
	const [awayScore, setAwayScore] = useState<number | null>(null);

	const { mutate: createFromFixture } = useMutation({
		mutationFn: async (data: {
			seasonSlug: string;
			homeScore: number;
			awayScore: number;
			fixtureId: string;
		}) => {
			return await trpcClient.match.createFromFixture.mutate(data);
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: trpc.season.getFixtures.queryKey({ seasonSlug }),
			});
			await queryClient.invalidateQueries({
				queryKey: trpc.seasonPlayer.getStanding.queryKey({ seasonSlug }),
			});
			await queryClient.invalidateQueries({
				queryKey: trpc.match.getLatest.queryKey({ seasonSlug }),
			});
			await queryClient.invalidateQueries({
				queryKey: trpc.seasonPlayer.getTop.queryKey({ seasonSlug }),
			});
			setIsSubmitting(false);
			setAwayScore(null);
			setHomeScore(null);
			toast.success("Match created successfully");
		},
		onError: () => {
			setIsSubmitting(false);
			setShowMatchCreate(true);
			toast.error("Failed to create match. Please try again.");
		},
	});

	const homePlayer = {
		id: fixture.homePlayerId,
		name: fixture.homePlayerName ?? "Unknown",
		image: fixture.homePlayerImage ?? null,
	};

	const awayPlayer = {
		id: fixture.awayPlayerId,
		name: fixture.awayPlayerName ?? "Unknown",
		image: fixture.awayPlayerImage ?? null,
	};

	const displayHomeScore = fixture.homeScore ?? homeScore;
	const displayAwayScore = fixture.awayScore ?? awayScore;
	const hasScores = displayHomeScore !== null && displayAwayScore !== null;
	const homeWinner = hasScores && (displayHomeScore ?? 0) > (displayAwayScore ?? 0);
	const awayWinner = hasScores && (displayAwayScore ?? 0) > (displayHomeScore ?? 0);

	const getPlayerName = (name: string) => {
		const parts = name.split(" ");
		return parts.length > 2 ? `${parts[0]} ${parts[1]}` : parts[0];
	};

	return (
		<div className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-lg transition-colors">
			<div className="flex-1 min-w-0">
				<div className="space-y-2">
					<div className="flex items-center gap-3">
						<AvatarWithFallback src={homePlayer.image} name={homePlayer.name} size="sm" />
						<span className={cn("text-sm flex-1 truncate min-w-0", homeWinner && "font-bold")}>
							{getPlayerName(homePlayer.name)}
						</span>
						<div className="flex items-center gap-2 shrink-0">
							<div
								className={cn(
									"flex h-7 w-7 items-center justify-center rounded-md border text-sm font-medium shrink-0 transition-all duration-200",
									showMatchCreate
										? "bg-primary/10 scale-110 ring-2 ring-primary/20"
										: hasScores
											? "bg-primary/10"
											: "",
									homeWinner && !showMatchCreate && "bg-primary/20 font-bold"
								)}
							>
								{showMatchCreate ? (homeScore ?? 0) : (displayHomeScore ?? "")}
							</div>
							<div
								className={cn(
									"grid transition-all duration-200 ease-out",
									showMatchCreate ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0"
								)}
							>
								<div className="overflow-hidden">
									<ScoreStepper
										score={homeScore ?? 0}
										setScore={(newScore) => {
											setHomeScore(newScore);
											setAwayScore((prev) => prev ?? 0);
										}}
									/>
								</div>
							</div>
						</div>
					</div>

					<div className="flex items-center gap-3">
						<AvatarWithFallback src={awayPlayer.image} name={awayPlayer.name} size="sm" />
						<span className={cn("text-sm flex-1 truncate min-w-0", awayWinner && "font-bold")}>
							{getPlayerName(awayPlayer.name)}
						</span>
						<div className="flex items-center gap-2 shrink-0">
							<div
								className={cn(
									"flex h-7 w-7 items-center justify-center rounded-md border text-sm font-medium shrink-0 transition-all duration-200",
									showMatchCreate
										? "bg-primary/10 scale-110 ring-2 ring-primary/20"
										: hasScores
											? "bg-primary/10"
											: "",
									awayWinner && !showMatchCreate && "bg-primary/20 font-bold"
								)}
							>
								{showMatchCreate ? (awayScore ?? 0) : (displayAwayScore ?? "")}
							</div>
							<div
								className={cn(
									"grid transition-all duration-200 ease-out",
									showMatchCreate ? "grid-cols-[1fr] opacity-100" : "grid-cols-[0fr] opacity-0"
								)}
							>
								<div className="overflow-hidden">
									<ScoreStepper
										score={awayScore ?? 0}
										setScore={(newScore) => {
											setHomeScore((prev) => prev ?? 0);
											setAwayScore(newScore);
										}}
									/>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="flex flex-col items-center justify-center gap-1 pl-2 border-l">
				{showMatchCreate ? (
					<>
						<Button
							variant="ghost"
							size="sm"
							className="h-7 w-7 p-0"
							onClick={() => {
								setShowMatchCreate(false);
								setIsSubmitting(true);
								createFromFixture({
									seasonSlug,
									homeScore: homeScore ?? 0,
									awayScore: awayScore ?? 0,
									fixtureId: fixture.id,
								});
							}}
						>
							<Tick01Icon size={14} className="text-green-500" />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							className="h-7 w-7 p-0"
							onClick={() => {
								setShowMatchCreate(false);
								setHomeScore(null);
								setAwayScore(null);
							}}
						>
							<Cancel01Icon size={14} className="text-red-500" />
						</Button>
					</>
				) : (
					<Button
						variant="ghost"
						size="sm"
						disabled={Boolean(fixture.matchId || isSubmitting)}
						onClick={() => setShowMatchCreate(true)}
						className="h-8 w-8 p-0"
					>
						{!fixture.matchId && isSubmitting ? (
							<Loading03Icon className="h-4 w-4 animate-spin" />
						) : (
							<PencilEdit01Icon
								className={cn("h-4 w-4", (fixture.matchId || isSubmitting) && "opacity-0")}
							/>
						)}
					</Button>
				)}
			</div>
		</div>
	);
};

export function Fixtures({ seasonSlug }: FixturesProps) {
	const trpc = useTRPC();
	const { data: fixtures, isLoading } = useQuery(
		trpc.season.getFixtures.queryOptions({ seasonSlug })
	);

	const { data: players } = useQuery(trpc.seasonPlayer.getAll.queryOptions({ seasonSlug }));

	const [showPrev, setShowPrev] = useState(false);
	const [showNext, setShowNext] = useState(false);

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

	const fixturesByRound = fixtures.reduce<Record<number, Fixture[]>>((acc, fixture) => {
		if (!acc[fixture.round]) {
			acc[fixture.round] = [];
		}

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

	const currentRoundIndex = rounds.findIndex((round) =>
		fixturesByRound[round].some((f) => !f.matchId)
	);
	const currentRound =
		currentRoundIndex >= 0 ? rounds[currentRoundIndex] : rounds[rounds.length - 1];

	const firstRound = rounds[0];
	const lastRound = rounds[rounds.length - 1];

	const roundsToShow = currentRound
		? [
				...(showPrev ? rounds.slice(0, currentRoundIndex) : []),
				currentRound,
				...(showNext ? rounds.slice(currentRoundIndex + 1) : []),
			]
		: rounds;

	return (
		<div className="flex w-full flex-col gap-2">
			{firstRound && roundsToShow.indexOf(firstRound) === -1 && (
				<Button
					size="sm"
					variant="ghost"
					className="text-muted-foreground"
					onClick={() => setShowPrev(true)}
				>
					Show previous rounds
				</Button>
			)}
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
						<div className="h-px bg-border" />
						<div className="space-y-1">
							{fixturesByRound[round].map((fixture, i) => (
								<div key={fixture.id}>
									<FixtureRow fixture={fixture} seasonSlug={seasonSlug} />
									{i < fixturesByRound[round].length - 1 && <div className="h-px bg-border/50" />}
								</div>
							))}
						</div>
					</div>
				))}
			</div>
			{lastRound && roundsToShow.indexOf(lastRound) === -1 && (
				<Button
					size="sm"
					variant="ghost"
					className="text-muted-foreground"
					onClick={() => setShowNext(true)}
				>
					Show upcoming rounds
				</Button>
			)}
		</div>
	);
}
