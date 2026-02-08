import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Header } from "@/components/layout/header";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";
import { useSession } from "@/hooks/useSession";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { DashboardCards } from "@/components/season/dashboard-cards";
import { StandingTabs } from "@/components/season/standing-tabs";
import { LatestMatches } from "@/components/season/latest-matches";
import { Fixtures } from "@/components/season/fixtures";
import { OverviewCard } from "@/components/season/overview-card";
import { CreateMatchDialog } from "@/components/match/create-match-drawer";
import { useSeasonSSE } from "@/hooks/use-season-sse";

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/")(
	{
		component: SeasonDashboardPage,
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

	const { data: session } = useSession();
	const { data: activeMember } = authClient.useActiveMember();
	const role = activeMember?.role;
	const canCreateMatches = role === "owner" || role === "editor";

	const { data: season, error } = useQuery({
		queryKey: ["season", seasonSlug],
		queryFn: async () => {
			return await trpcClient.season.getBySlug.query({ seasonSlug });
		},
	});

	const seasonId = season?.id;

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

	const [isCreateMatchOpen, setIsCreateMatchOpen] = useState(false);

	return (
		<>
			<Header
				rightContent={
					canCreateMatches && (
						<GlowButton
							icon={Add01Icon}
							glowColor={glowColors.blue}
							size="sm"
							className="gap-1.5"
							onClick={() => setIsCreateMatchOpen(true)}
							disabled={isSeasonLocked}
						>
							Match
						</GlowButton>
					)
				}
			>
				<SidebarTrigger className="-ml-1" />
				<Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem className="hidden md:block">
							<BreadcrumbLink href="/leagues">Leagues</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden md:block" />
						<BreadcrumbItem>
							<BreadcrumbLink href={`/leagues/${slug}`}>{truncateSlug(slug)}</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden md:block" />
						<BreadcrumbItem>
							<BreadcrumbLink href={`/leagues/${slug}/seasons`}>Seasons</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden md:block" />
						<BreadcrumbItem>
							<BreadcrumbPage>{season?.name ?? truncateSlug(seasonSlug)}</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</Header>
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<DashboardCards slug={slug} seasonSlug={seasonSlug} />
				<div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
					<div className="flex flex-col gap-4">
						{seasonId && (
							<>
								<StandingTabs seasonId={seasonId} seasonSlug={seasonSlug} />
								<LatestMatches seasonId={seasonId} seasonSlug={seasonSlug} />
							</>
						)}
					</div>
					<div className="flex flex-col gap-4">
						{!isEloSeason && season && (
							<OverviewCard title="Fixtures">
								<Fixtures slug={slug} seasonSlug={seasonSlug} />
							</OverviewCard>
						)}
					</div>
				</div>
			</div>
			{isEloSeason && seasonId && (
				<CreateMatchDialog
					isOpen={isCreateMatchOpen}
					onClose={() => setIsCreateMatchOpen(false)}
					seasonId={seasonId}
					seasonSlug={seasonSlug}
				/>
			)}
		</>
	);
}
