import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Header } from "@/components/layout/header";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { useQuery } from "@tanstack/react-query";
import {
	ensureEntry,
	fromHandle,
	loadHandles,
	prefetchEntry,
} from "@trpc/tanstack-react-query/unstable-handles";
import { useTRPC } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";
import { truncateSlug } from "@coding-cowboys/scorebrawl-core/presentation";
import { Add01Icon, PlayIcon, Share01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { DashboardCards } from "../-components/season/dashboard-cards";
import { StandingTabs } from "../-components/season/standing-tabs";
import { TeamStandingCard } from "../-components/season/team-standing-card";
import { LatestMatches } from "../-components/season/latest-matches";
import { Fixtures } from "../-components/season/fixtures";
import { OverviewCard } from "../-components/season/overview-card";
import { SeasonCeremony } from "../-components/season/season-ceremony";
import { CreateMatchDialog } from "../-components/match/create-match-drawer";
import { CreateOneVnGameDialog } from "../-components/match/create-one-vn-game-drawer";
import { WeeklyPerformers } from "../-components/season/weekly-performers";
import { SessionHistory } from "../-components/session/session-history";
import { SessionConfigDialog } from "../-components/session/session-config-dialog";
import { ShareStandingsDialog } from "../-components/share/share-standings-dialog";
import { z } from "zod";

const seasonDashboardSearchSchema = z.object({
	addMatch: z.boolean().optional(),
	startSession: z.boolean().optional(),
});

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/")(
	{
		component: SeasonDashboardPage,
		validateSearch: seasonDashboardSearchSchema,
		loader: async ({ context, params }) => {
			const trpc = context.trpc;
			const { seasonSlug } = params;

			const [handles] = await loadHandles(trpc, {
				season: ensureEntry(trpc.season.getBySlug, { seasonSlug }),
				countInfo: ensureEntry(trpc.season.getCountInfo, { seasonSlug }),
				activeSession: prefetchEntry(trpc.session.getActive, { seasonSlug }),
				latestMatch: prefetchEntry(trpc.match.getLatest, { seasonSlug }),
				topPlayer: prefetchEntry(trpc.seasonPlayer.getTop, { seasonSlug }),
				standings: prefetchEntry(trpc.seasonPlayer.getStanding, { seasonSlug }),
				players: prefetchEntry(trpc.seasonPlayer.getAll, { seasonSlug }),
				fixtures: prefetchEntry(trpc.season.getFixtures, { seasonSlug }),
				recentMatches: prefetchEntry(trpc.match.getAll, {
					seasonSlug,
					limit: 5,
					offset: 0,
				}),
				weeklyPlayerStats: prefetchEntry(trpc.seasonPlayer.getWeeklyStats, { seasonSlug }),
				weeklyTeamStats: prefetchEntry(trpc.seasonTeam.getWeeklyStats, { seasonSlug }),
				endedSessions: prefetchEntry(trpc.session.listEnded, { seasonSlug, limit: 10 }),
			});

			return handles;
		},
	}
);

function SeasonDashboardPage() {
	const handles = Route.useLoaderData();
	const { slug, seasonSlug } = Route.useParams();
	const navigate = useNavigate({ from: Route.fullPath });
	const trpc = useTRPC();

	const { data: activeMember } = authClient.useActiveMember();
	const role = activeMember?.role;
	const canCreateMatches = role === "owner" || role === "editor" || role === "member";
	const canCreateSeasons = role === "owner" || role === "editor";

	const { data: season } = useQuery(fromHandle(trpc, handles.season));

	const { data: countInfo } = useQuery(fromHandle(trpc, handles.countInfo));
	const hasTeams = (countInfo?.teamCount ?? 0) > 0;

	const isEloSeason = season?.scoreType === "elo" || season?.scoreType === "1-v-n-elo";
	const isSeasonLocked = season?.closed || season?.archived;

	const { data: activeSession } = useQuery(fromHandle(trpc, handles.activeSession));

	const canShare = role === "owner" || role === "editor";
	const [isShareOpen, setIsShareOpen] = useState(false);

	const { addMatch, startSession } = Route.useSearch();
	const isCreateMatchOpen = addMatch === true;
	const setIsCreateMatchOpen = (open: boolean) => {
		navigate({
			to: ".",
			search: open ? { addMatch: true } : {},
			replace: !open,
		});
	};
	const isStartSessionOpen = startSession === true;
	const setIsStartSessionOpen = (open: boolean) => {
		navigate({
			to: ".",
			search: open ? { startSession: true } : {},
			replace: !open,
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
						{canShare && (
							<Button
								size="sm"
								variant="ghost"
								className="gap-1.5"
								onClick={() => setIsShareOpen(true)}
								data-testid="share-standings-button"
							>
								<HugeiconsIcon icon={Share01Icon} className="size-3.5" />
								Share
							</Button>
						)}
						{canCreateMatches &&
							!isSeasonLocked &&
							season?.scoreType !== "1-v-n-elo" &&
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
									data-testid="start-session-button"
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
				{season?.closed && (
					<SeasonCeremony
						seasonSlug={seasonSlug}
						season={season}
						leagueSlug={slug}
						canStartNextSeason={canCreateSeasons}
						onShare={canShare ? () => setIsShareOpen(true) : undefined}
					/>
				)}
				<DashboardCards seasonSlug={seasonSlug} handles={handles} />

				{hasTeams ? (
					<div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
						<div className="flex flex-col gap-4">
							<StandingTabs seasonSlug={seasonSlug} leagueSlug={slug} />
							{!isEloSeason && season && (
								<OverviewCard title="Fixtures">
									<Fixtures seasonSlug={seasonSlug} handles={handles} />
								</OverviewCard>
							)}
							<LatestMatches
								seasonSlug={seasonSlug}
								slug={slug}
								canDelete={canCreateMatches && !isSeasonLocked}
								handle={handles.recentMatches}
							/>
							<SessionHistory seasonSlug={seasonSlug} slug={slug} handle={handles.endedSessions} />
						</div>
						<div className="hidden lg:flex flex-col gap-4">
							<TeamStandingCard seasonSlug={seasonSlug} leagueSlug={slug} />
							<WeeklyPerformers handles={handles} />
						</div>
					</div>
				) : (
					<div className="flex flex-col gap-4">
						<StandingTabs seasonSlug={seasonSlug} leagueSlug={slug} />
						{!isEloSeason && season && (
							<OverviewCard title="Fixtures">
								<Fixtures seasonSlug={seasonSlug} handles={handles} />
							</OverviewCard>
						)}
						<LatestMatches
							seasonSlug={seasonSlug}
							slug={slug}
							canDelete={canCreateMatches && !isSeasonLocked}
							handle={handles.recentMatches}
						/>
						<SessionHistory seasonSlug={seasonSlug} slug={slug} handle={handles.endedSessions} />
					</div>
				)}
			</div>
			{season?.scoreType === "1-v-n-elo" && (
				<CreateOneVnGameDialog
					isOpen={isCreateMatchOpen}
					onClose={() => setIsCreateMatchOpen(false)}
					seasonSlug={seasonSlug}
				/>
			)}
			{season?.scoreType === "elo" && (
				<CreateMatchDialog
					isOpen={isCreateMatchOpen}
					onClose={() => setIsCreateMatchOpen(false)}
					seasonSlug={seasonSlug}
				/>
			)}
			{canShare && (
				<ShareStandingsDialog
					isOpen={isShareOpen}
					onClose={() => setIsShareOpen(false)}
					seasonSlug={seasonSlug}
					isClosedSeason={!!season?.closed}
				/>
			)}
			{canCreateMatches &&
				!isSeasonLocked &&
				season?.scoreType !== "1-v-n-elo" &&
				!activeSession && (
					<SessionConfigDialog
						mode="create"
						isOpen={isStartSessionOpen}
						onClose={() => setIsStartSessionOpen(false)}
						seasonSlug={seasonSlug}
						leagueSlug={slug}
					/>
				)}
		</>
	);
}
