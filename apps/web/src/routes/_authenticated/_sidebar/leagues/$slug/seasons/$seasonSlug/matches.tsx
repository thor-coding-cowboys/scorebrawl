import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/layout/header";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { trpcClient, useTRPC } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";
import {
	Add01Icon,
	ArrowDown01Icon,
	Award01Icon,
	Delete01Icon,
	PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchRow } from "../-components/match/match-row";
import { CreateMatchDialog } from "../-components/match/create-match-drawer";
import { RemoveMatchDialog } from "../-components/match/remove-match-dialog";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { z } from "zod";
import { queryClient } from "@/lib/query-client";
import { truncateSlug } from "@/lib/utils";

const matchesSearchSchema = z.object({
	addMatch: z.boolean().optional(),
});

export const Route = createFileRoute(
	"/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/matches"
)({
	component: MatchesPage,
	validateSearch: matchesSearchSchema,
	loader: async ({ params, context }) => {
		const { seasonSlug } = params;
		const trpc = context.trpc;
		await queryClient.ensureQueryData(trpc.season.getBySlug.queryOptions({ seasonSlug }));
		return { slug: params.slug, seasonSlug };
	},
});

const PAGE_SIZE = 30;

function MatchesPage() {
	const { slug, seasonSlug } = Route.useLoaderData();
	const { addMatch } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { data: activeMember } = authClient.useActiveMember();
	const role = activeMember?.role;
	const canCreateMatches = role === "owner" || role === "editor" || role === "member";
	const canDeleteMatches = role === "owner" || role === "editor";
	const canEditMatches = role === "owner" || role === "editor";
	const trpc = useTRPC();

	const { data: season } = useQuery(trpc.season.getBySlug.queryOptions({ seasonSlug }));

	const seasonId = season?.id ?? "";
	const isSeasonLocked = season?.closed || season?.archived;

	const isCreateMatchOpen = addMatch === true;
	const setIsCreateMatchOpen = (open: boolean) => {
		navigate({ search: open ? { addMatch: true } : {} });
	};
	const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
	const [editMatch, setEditMatch] = useState<(typeof matches)[0] | null>(null);
	const [insertAfterMatch, setInsertAfterMatch] = useState<(typeof matches)[0] | null>(null);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isInsertDialogOpen, setIsInsertDialogOpen] = useState(false);

	// New state for skeleton insert flow
	const [skeletonPosition, setSkeletonPosition] = useState<number | null>(null);
	const skeletonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useInfiniteQuery({
		queryKey: ["infinite-matches", seasonId],
		queryFn: async ({ pageParam }) => {
			return trpcClient.match.getAll.query({
				seasonSlug,
				limit: PAGE_SIZE,
				offset: pageParam,
			});
		},
		initialPageParam: 0,
		getNextPageParam: (lastPage, _allPages, lastPageParam) => {
			if (!lastPage?.matches?.length) return undefined;
			if (lastPage.matches.length < PAGE_SIZE) return undefined;
			const nextOffset = lastPageParam + PAGE_SIZE;
			if (nextOffset >= lastPage.total) return undefined;
			return nextOffset;
		},
		enabled: !!seasonId && !!seasonSlug,
		refetchOnWindowFocus: false,
		staleTime: 30000,
	});

	const matches = data?.pages.flatMap((page) => page.matches) ?? [];
	const total = data?.pages[0]?.total ?? 0;
	const latestMatch = matches[0];

	const parentRef = useRef<HTMLDivElement>(null);

	// Include skeleton in virtual count when active
	const virtualCount = skeletonPosition !== null ? matches.length + 1 : matches.length;

	const virtualizer = useVirtualizer({
		count: virtualCount,
		getScrollElement: () => parentRef.current,
		estimateSize: () => 100,
		overscan: 5,
	});

	// Use refs to avoid stale closures in scroll handler
	const fetchNextPageRef = useRef(fetchNextPage);
	const hasNextPageRef = useRef(hasNextPage);
	const isFetchingNextPageRef = useRef(isFetchingNextPage);

	useEffect(() => {
		fetchNextPageRef.current = fetchNextPage;
		hasNextPageRef.current = hasNextPage;
		isFetchingNextPageRef.current = isFetchingNextPage;
	}, [fetchNextPage, hasNextPage, isFetchingNextPage]);

	// Use window scroll for infinite loading since page scrolls at document level
	useEffect(() => {
		if (!seasonId) return;

		const handleScroll = () => {
			if (isFetchingNextPageRef.current || !hasNextPageRef.current) return;

			const scrollTop = window.scrollY;
			const windowHeight = window.innerHeight;
			const documentHeight = document.documentElement.scrollHeight;
			const scrolledToBottom = scrollTop + windowHeight >= documentHeight - 200;

			if (scrolledToBottom) {
				fetchNextPageRef.current();
			}
		};

		window.addEventListener("scroll", handleScroll);

		return () => window.removeEventListener("scroll", handleScroll);
	}, [seasonId]);

	// Cleanup timer on unmount
	useEffect(() => {
		return () => {
			if (skeletonTimerRef.current) {
				clearTimeout(skeletonTimerRef.current);
			}
		};
	}, []);

	const handleInsertClick = (match: (typeof matches)[0], position: number) => {
		// Clear any existing timer
		if (skeletonTimerRef.current) {
			clearTimeout(skeletonTimerRef.current);
		}

		// Show skeleton at this position
		setSkeletonPosition(position);
		setInsertAfterMatch(match);

		// After 3 seconds, open the dialog
		skeletonTimerRef.current = setTimeout(() => {
			setIsInsertDialogOpen(true);
		}, 3000);
	};

	const handleInsertDialogClose = () => {
		setIsInsertDialogOpen(false);
		setInsertAfterMatch(null);
		setSkeletonPosition(null);
		if (skeletonTimerRef.current) {
			clearTimeout(skeletonTimerRef.current);
			skeletonTimerRef.current = null;
		}
	};

	// Get match at adjusted index (accounting for skeleton)
	const getMatchAtIndex = (index: number): (typeof matches)[0] | null => {
		if (skeletonPosition === null) {
			return matches[index] || null;
		}
		// If skeleton is before this index, adjust
		if (index <= skeletonPosition) {
			return matches[index] || null;
		}
		// After skeleton, subtract 1
		return matches[index - 1] || null;
	};

	// Check if this index is the skeleton position
	const isSkeletonAtIndex = (index: number): boolean => {
		return skeletonPosition === index;
	};

	return (
		<>
			<Header
				breadcrumbs={[
					{ name: "Leagues", href: "/leagues" },
					{ name: truncateSlug(slug), href: `/leagues/${slug}` },
					{ name: "Seasons", href: `/leagues/${slug}/seasons` },
					{
						name: season?.name ?? truncateSlug(seasonSlug),
						href: `/leagues/${slug}/seasons/${seasonSlug}`,
					},
					{ name: "Matches" },
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
						>
							Match
						</GlowButton>
					)
				}
			/>
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0 min-h-0">
				<div className="grid gap-3 md:grid-cols-1">
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.1),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">Total Matches</CardTitle>
							<HugeiconsIcon icon={Award01Icon} className="size-4 text-blue-600" />
						</CardHeader>
						<CardContent className="relative">
							<div className="text-2xl font-bold">{total}</div>
							<p className="text-xs text-muted-foreground">All matches in this season</p>
						</CardContent>
					</Card>
				</div>
				<div className="bg-muted/50 flex-1 flex flex-col p-6 min-h-0">
					{matches.length === 0 && !isLoading ? (
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
						<div className="flex flex-col flex-1 gap-4 min-h-0">
							<div className="flex items-center justify-between">
								<h3 className="text-lg font-medium">Matches</h3>
								{canDeleteMatches && !isSeasonLocked && latestMatch && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setIsRemoveDialogOpen(true)}
										className="text-muted-foreground hover:text-destructive"
									>
										<span className="hidden sm:inline">Remove Latest</span>
										<HugeiconsIcon icon={Delete01Icon} className="sm:hidden size-4" />
									</Button>
								)}
							</div>
							<div ref={parentRef} className="flex-1 overflow-auto rounded-lg bg-card px-4 min-h-0">
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
											// Check if this is the skeleton position
											if (isSkeletonAtIndex(virtualItem.index)) {
												return (
													<div
														key="skeleton-insert"
														data-index={virtualItem.index}
														ref={virtualizer.measureElement}
														style={{
															position: "absolute",
															top: 0,
															left: 0,
															width: "100%",
															transform: `translateY(${virtualItem.start}px)`,
														}}
														className="border-b border-border/50 py-3 px-2 overflow-hidden"
													>
														<div className="flex items-center gap-3 py-2">
															<Skeleton className="h-8 w-8 rounded-full" />
															<div className="flex-1 space-y-2">
																<Skeleton className="h-4 w-3/4" />
																<Skeleton className="h-3 w-1/2" />
															</div>
															<div className="flex items-center gap-2">
																<Skeleton className="h-8 w-12" />
																<span className="text-muted-foreground">-</span>
																<Skeleton className="h-8 w-12" />
															</div>
														</div>
														<div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-2">
															<HugeiconsIcon icon={ArrowDown01Icon} className="size-3" />
															<span>New match will be inserted here</span>
															<HugeiconsIcon icon={Add01Icon} className="size-3" />
														</div>
													</div>
												);
											}

											const match = getMatchAtIndex(virtualItem.index);
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
													className="hover:bg-muted/50 transition-colors border-b border-border/50 last:border-b-0 py-3 px-2 overflow-hidden group"
												>
													<div className="flex items-center gap-2">
														<div className="flex-1">
															<MatchRow
																match={match}
																seasonSlug={seasonSlug}
																seasonId={seasonId ?? ""}
															/>
														</div>
												{canEditMatches && !isSeasonLocked && (
													<div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
														<Button
															variant="secondary"
															size="sm"
															className="h-8 px-3 gap-1.5 text-xs"
															onClick={() => {
																setEditMatch(match);
																setIsEditDialogOpen(true);
															}}
															data-testid={`edit-match-${match.id}`}
														>
															<HugeiconsIcon icon={PencilEdit01Icon} className="size-3.5" />
															<span className="hidden sm:inline">Edit</span>
														</Button>
														<Button
															variant="default"
															size="sm"
															className="h-8 px-3 gap-1.5 text-xs"
															onClick={() => handleInsertClick(match, virtualItem.index + 1)}
															data-testid={`insert-after-match-${match.id}`}
															disabled={skeletonPosition !== null}
															title="Insert match below"
														>
															<div className="relative flex items-center">
																<HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
																<HugeiconsIcon icon={Add01Icon} className="size-3 -ml-0.5" />
															</div>
															<span className="hidden sm:inline">Insert</span>
														</Button>
													</div>
												)}
													</div>
												</div>
											);
										})}
								</div>
							</div>
							{isFetchingNextPage && (
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
			{seasonId && latestMatch && (
				<RemoveMatchDialog
					isOpen={isRemoveDialogOpen}
					onClose={() => setIsRemoveDialogOpen(false)}
					matchId={latestMatch.id}
					matchInfo={latestMatch}
					seasonSlug={seasonSlug}
					seasonId={seasonId}
				/>
			)}
			{seasonId && editMatch && (
				<CreateMatchDialog
					isOpen={isEditDialogOpen}
					onClose={() => {
						setIsEditDialogOpen(false);
						setEditMatch(null);
					}}
					seasonId={seasonId}
					seasonSlug={seasonSlug}
					mode="edit"
					matchToEdit={editMatch}
					onRemove={() => {
						setIsEditDialogOpen(false);
						setIsRemoveDialogOpen(true);
					}}
				/>
			)}
			{seasonId && insertAfterMatch && (
				<CreateMatchDialog
					isOpen={isInsertDialogOpen}
					onClose={handleInsertDialogClose}
					seasonId={seasonId}
					seasonSlug={seasonSlug}
					mode="insert"
					matchToEdit={insertAfterMatch}
				/>
			)}
		</>
	);
}
