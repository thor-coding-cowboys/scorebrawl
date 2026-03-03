import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Header } from "@/components/layout/header";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";
import { useSession } from "@/hooks/useSession";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { DashboardCards } from "../-components/season/dashboard-cards";
import { StandingTabs } from "../-components/season/standing-tabs";
import { TeamStandingCard } from "../-components/season/team-standing-card";
import { LatestMatches } from "../-components/season/latest-matches";
import { Fixtures } from "../-components/season/fixtures";
import { OverviewCard } from "../-components/season/overview-card";
import { CreateMatchDialog } from "../-components/match/create-match-drawer";
import { WeeklyPerformers } from "../-components/season/weekly-performers";
import { useSeasonSSE } from "@/hooks/use-season-sse";
import { useCoinToss } from "@/hooks/use-coin-toss";
import { CoinTossOverlay } from "../-components/season/coin-toss-overlay";
import { z } from "zod";

const seasonDashboardSearchSchema = z.object({
	addMatch: z.boolean().optional(),
});

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/")(
	{
		component: SeasonDashboardPage,
		validateSearch: seasonDashboardSearchSchema,
		loader: async ({ params }) => {
			return { slug: params.slug, seasonSlug: params.seasonSlug };
		},
	}
);

function truncateSlug(slug: string, maxLength = 10): string {
	if (slug.length <= maxLength) return slug;
	return `${slug.slice(0, maxLength)}...`;
}

function SeasonDashboardPage() {
	const { slug, seasonSlug } = Route.useLoaderData();
	const navigate = useNavigate();
	const trpc = useTRPC();

	const { data: session } = useSession();
	const { data: activeMember } = authClient.useActiveMember();
	const role = activeMember?.role;
	const canCreateMatches = role === "owner" || role === "editor" || role === "member";

	const { data: season, error } = useQuery(trpc.season.getBySlug.queryOptions({ seasonSlug }));

	const seasonId = season?.id;

	// Fetch team count to determine layout
	const { data: countInfo } = useQuery(trpc.season.getCountInfo.queryOptions({ seasonSlug }));
	const hasTeams = (countInfo?.teamCount ?? 0) > 0;

	// Connect to SSE for real-time updates
	useSeasonSSE({
		leagueSlug: slug,
		seasonSlug,
		seasonId: seasonId ?? "",
		currentUserId: session?.user.id,
		enabled: !!seasonId,
	});

	useEffect(() => {
		if (error) {
			navigate({
				to: "/leagues/$slug/seasons",
				params: { slug },
			});
		}
	}, [error, navigate, slug]);

	const isEloSeason = season?.scoreType === "elo";
	const isSeasonLocked = season?.closed || season?.archived;

	const { addMatch } = Route.useSearch();
	const isCreateMatchOpen = addMatch === true;
	const setIsCreateMatchOpen = (open: boolean) => {
		navigate({
			to: ".",
			search: open ? { addMatch: true } : {},
		});
	};

	const { visible: coinVisible, result: coinResult, dismiss: coinDismiss } = useCoinToss();

	return (
		<>
			<Header
				breadcrumbs={[
					{ name: "Leagues", href: "/leagues" },
					{ name: truncateSlug(slug), href: `/leagues/${slug}` },
					{ name: "Seasons", href: `/leagues/${slug}/seasons` },
					{ name: season?.name ?? truncateSlug(seasonSlug) },
				]}
				rightContent={
					canCreateMatches && (
						<GlowButton
							icon={Add01Icon}
							glowColor={glowColors.blue}
							size="sm"
							className="gap-1.5"
							onClick={() => setIsCreateMatchOpen(true)}
							disabled={isSeasonLocked}
							data-testid="create-match-button"
						>
							Match
						</GlowButton>
					)
				}
			/>
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<DashboardCards seasonSlug={seasonSlug} />

				{hasTeams ? (
					<div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
						<div className="flex flex-col gap-4">
							<StandingTabs seasonSlug={seasonSlug} leagueSlug={slug} />
							{!isEloSeason && season && (
								<OverviewCard title="Fixtures">
									<Fixtures seasonSlug={seasonSlug} />
								</OverviewCard>
							)}
							{seasonId && (
								<LatestMatches
									seasonId={seasonId}
									seasonSlug={seasonSlug}
									canDelete={canCreateMatches && !isSeasonLocked}
								/>
							)}
						</div>
						<div className="hidden lg:flex flex-col gap-4">
							<TeamStandingCard seasonSlug={seasonSlug} />
							<WeeklyPerformers seasonSlug={seasonSlug} />
						</div>
					</div>
				) : (
					<div className="flex flex-col gap-4">
						<StandingTabs seasonSlug={seasonSlug} leagueSlug={slug} />
						{!isEloSeason && season && (
							<OverviewCard title="Fixtures">
								<Fixtures seasonSlug={seasonSlug} />
							</OverviewCard>
						)}
						{seasonId && (
							<LatestMatches
								seasonId={seasonId}
								seasonSlug={seasonSlug}
								canDelete={canCreateMatches && !isSeasonLocked}
							/>
						)}
					</div>
				)}
			</div>
			{isEloSeason && seasonId && (
				<CreateMatchDialog
					isOpen={isCreateMatchOpen}
					onClose={() => setIsCreateMatchOpen(false)}
					seasonId={seasonId}
					seasonSlug={seasonSlug}
				/>
			)}
			<CoinTossOverlay visible={coinVisible} result={coinResult} onDone={coinDismiss} />
		</>
	);
}
