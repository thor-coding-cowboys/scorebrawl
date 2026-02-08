import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
import { Add01Icon, Award01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMatches, loadMoreMatches } from "@/lib/collections";
import { MatchRow } from "@/components/match/match-row";
import { CreateMatchDialog } from "@/components/match/create-match-drawer";
import { useVirtualizer } from "@tanstack/react-virtual";

export const Route = createFileRoute(
	"/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/matches"
)({
	component: MatchesPage,
	loader: async ({ params }) => {
		return { slug: params.slug, seasonSlug: params.seasonSlug };
	},
});

function truncateSlug(slug: string, maxLength = 10): string {
	if (slug.length <= maxLength) return slug;
	return `${slug.slice(0, maxLength)}...`;
}

function MatchesPage() {
	const { slug, seasonSlug } = Route.useLoaderData();

	const { data: activeMember } = authClient.useActiveMember();
	const role = activeMember?.role;
	const canCreateMatches = role === "owner" || role === "editor";

	const { data: season } = useQuery({
		queryKey: ["season", seasonSlug],
		queryFn: async () => {
			return await trpcClient.season.getBySlug.query({ seasonSlug });
		},
	});

	const seasonId = season?.id;
	const isSeasonLocked = season?.closed || season?.archived;

	const [isCreateMatchOpen, setIsCreateMatchOpen] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [totalMatches, setTotalMatches] = useState<number | null>(null);

	const { matches } = useMatches(seasonId ?? "", seasonSlug);

	useEffect(() => {
		if (seasonId && totalMatches === null) {
			trpcClient.match.getAll
				.query({ seasonSlug, limit: 1, offset: 0 })
				.then((result) => setTotalMatches(result.total));
		}
	}, [seasonId, seasonSlug, totalMatches]);

	const parentRef = useRef<HTMLDivElement>(null);

	const virtualizer = useVirtualizer({
		count: matches.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 100,
		overscan: 5,
	});

	useEffect(() => {
		const virtualItems = virtualizer.getVirtualItems();
		const [lastItem] = [...virtualItems].reverse();

		if (!lastItem || !seasonId || isLoadingMore) return;

		if (
			lastItem.index >= matches.length - 1 &&
			totalMatches !== null &&
			matches.length < totalMatches
		) {
			setIsLoadingMore(true);
			loadMoreMatches(seasonId, seasonSlug, matches.length)
				.then((total) => setTotalMatches(total))
				.finally(() => setIsLoadingMore(false));
		}
	}, [virtualizer, matches.length, totalMatches, isLoadingMore, seasonId, seasonSlug]);

	const stats = {
		total: totalMatches ?? matches.length,
	};

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
							<BreadcrumbLink href={`/leagues/${slug}/seasons/${seasonSlug}`}>
								{season?.name ?? truncateSlug(seasonSlug)}
							</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden md:block" />
						<BreadcrumbItem>
							<BreadcrumbPage>Matches</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</Header>
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<div className="grid gap-3 md:grid-cols-1">
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.1),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">Total Matches</CardTitle>
							<HugeiconsIcon icon={Award01Icon} className="size-4 text-blue-600" />
						</CardHeader>
						<CardContent className="relative">
							<div className="text-2xl font-bold">{stats.total}</div>
							<p className="text-xs text-muted-foreground">All matches in this season</p>
						</CardContent>
					</Card>
				</div>
				<div className="bg-muted/50 min-h-[100vh] flex-1 md:min-h-min p-6">
					{matches.length === 0 ? (
						<div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm">
								<HugeiconsIcon icon={Award01Icon} className="size-5" />
							</div>
							<p>No matches yet</p>
							{canCreateMatches && (
								<GlowButton
									icon={Add01Icon}
									glowColor={glowColors.blue}
									variant="outline"
									onClick={() => setIsCreateMatchOpen(true)}
									className="gap-1.5"
									disabled={isSeasonLocked}
								>
									Create First Match
								</GlowButton>
							)}
						</div>
					) : (
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<h3 className="text-lg font-medium">Matches</h3>
								<span className="text-sm text-muted-foreground">
									Showing {matches.length}
									{totalMatches !== null && ` of ${totalMatches}`}
								</span>
							</div>
							<div
								ref={parentRef}
								className="h-[calc(100vh-400px)] overflow-auto border divide-y divide-border"
							>
								<div
									style={{
										height: `${virtualizer.getTotalSize()}px`,
										width: "100%",
										position: "relative",
									}}
								>
									{virtualizer
										.getVirtualItems()
										.map((virtualItem: ReturnType<typeof virtualizer.getVirtualItems>[number]) => {
											const match = matches[virtualItem.index];
											if (!match) return null;

											return (
												<div
													key={virtualItem.key}
													data-index={virtualItem.index}
													ref={virtualizer.measureElement}
													style={{
														position: "absolute",
														top: 0,
														left: 0,
														width: "100%",
														transform: `translateY(${virtualItem.start}px)`,
													}}
													className="hover:bg-muted/50 transition-colors border-b border-border last:border-b-0"
												>
													<MatchRow match={match} seasonSlug={seasonSlug} />
												</div>
											);
										})}
								</div>
							</div>
							{isLoadingMore && (
								<div className="flex justify-center py-4 text-sm text-muted-foreground">
									Loading more matches...
								</div>
							)}
						</div>
					)}
				</div>
			</div>
			{seasonId && (
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
