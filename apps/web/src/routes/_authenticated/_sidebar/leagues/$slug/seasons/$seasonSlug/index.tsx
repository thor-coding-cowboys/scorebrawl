import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Header } from "@/components/layout/header";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";
import { truncateSlug } from "@/lib/utils";
import { Add01Icon, PlayIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { DashboardCards } from "../-components/season/dashboard-cards";
import { StandingTabs } from "../-components/season/standing-tabs";
import { TeamStandingCard } from "../-components/season/team-standing-card";
import { LatestMatches } from "../-components/season/latest-matches";
import { Fixtures } from "../-components/season/fixtures";
import { OverviewCard } from "../-components/season/overview-card";
import { CreateMatchDialog } from "../-components/match/create-match-drawer";
import { CreateOneVnGameDialog } from "../-components/match/create-one-vn-game-drawer";
import { WeeklyPerformers } from "../-components/season/weekly-performers";
import { SessionHistory } from "../-components/session/session-history";
import { StartSessionDialog } from "../-components/session/start-session-dialog";
import { z } from "zod";

const seasonDashboardSearchSchema = z.object({
	addMatch: z.boolean().optional(),
	startSession: z.boolean().optional(),
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

function SeasonDashboardPage() {
	const { slug, seasonSlug } = Route.useLoaderData();
	const navigate = useNavigate({ from: Route.fullPath });
	const trpc = useTRPC();

	const { data: activeMember } = authClient.useActiveMember();
	const role = activeMember?.role;
	const canCreateMatches = role === "owner" || role === "editor" || role === "member";

	const { data: season, error } = useQuery(trpc.season.getBySlug.queryOptions({ seasonSlug }));

	const seasonId = season?.id;

	// Fetch team count to determine layout
	const { data: countInfo } = useQuery(trpc.season.getCountInfo.queryOptions({ seasonSlug }));
	const hasTeams = (countInfo?.teamCount ?? 0) > 0;

	useEffect(() => {
		if (error) {
			navigate({
				to: "/leagues/$slug/seasons",
				params: { slug },
			});
		}
	}, [error, navigate, slug]);

	const isEloSeason = season?.scoreType === "elo" || season?.scoreType === "1-v-n-elo";
	const isSeasonLocked = season?.closed || season?.archived;

	const { data: activeSession } = useQuery({
		...trpc.session.getActive.queryOptions({ seasonSlug }),
		enabled: !!season,
	});

	const { addMatch, startSession } = Route.useSearch();
	const isCreateMatchOpen = addMatch === true;
	const setIsCreateMatchOpen = (open: boolean) => {
		navigate({
			to: ".",
			search: open ? { addMatch: true } : {},
		});
	};
	const isStartSessionOpen = startSession === true;
	const setIsStartSessionOpen = (open: boolean) => {
		navigate({
			to: ".",
			search: open ? { startSession: true } : {},
		});
	};

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
					<div className="flex items-center gap-2">
						{canCreateMatches &&
							!isSeasonLocked &&
							(activeSession ? (
								<Button
									size="sm"
									variant="outline"
									className="gap-1.5"
									render={
										<Link
											to="/leagues/$slug/seasons/$seasonSlug/session/$sessionId"
											params={{ slug, seasonSlug, sessionId: activeSession.id }}
										/>
									}
								>
									<HugeiconsIcon icon={PlayIcon} className="size-3.5" />
									Session
								</Button>
							) : (
								<Button
									size="sm"
									variant="outline"
									className="gap-1.5"
									onClick={() => setIsStartSessionOpen(true)}
								>
									<HugeiconsIcon icon={PlayIcon} className="size-3.5" />
									Start Session
								</Button>
							))}
						{canCreateMatches && (
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
						)}
					</div>
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
									slug={slug}
									canDelete={canCreateMatches && !isSeasonLocked}
								/>
							)}
							<SessionHistory seasonSlug={seasonSlug} slug={slug} />
						</div>
						<div className="hidden lg:flex flex-col gap-4">
							<TeamStandingCard seasonSlug={seasonSlug} leagueSlug={slug} />
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
								slug={slug}
								canDelete={canCreateMatches && !isSeasonLocked}
							/>
						)}
						<SessionHistory seasonSlug={seasonSlug} slug={slug} />
					</div>
				)}
			</div>
			{isEloSeason && seasonId && season?.scoreType === "1-v-n-elo" && (
				<CreateOneVnGameDialog
					isOpen={isCreateMatchOpen}
					onClose={() => setIsCreateMatchOpen(false)}
					seasonId={seasonId}
					seasonSlug={seasonSlug}
				/>
			)}
			{isEloSeason && seasonId && season?.scoreType === "elo" && (
				<CreateMatchDialog
					isOpen={isCreateMatchOpen}
					onClose={() => setIsCreateMatchOpen(false)}
					seasonId={seasonId}
					seasonSlug={seasonSlug}
				/>
			)}
			{canCreateMatches && !isSeasonLocked && !activeSession && (
				<StartSessionDialog
					isOpen={isStartSessionOpen}
					onClose={() => setIsStartSessionOpen(false)}
					seasonSlug={seasonSlug}
					leagueSlug={slug}
				/>
			)}
		</>
	);
}
