import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/layout/header";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { trpcClient, useTRPC } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";
import {
	Add01Icon,
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
import { z } from "zod";
import { queryClient } from "@/lib/query-client";
import { truncateSlug } from "@/lib/utils";
import { cn } from "@/lib/utils";

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
	const [isEditMode, setIsEditMode] = useState(false);

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

	// In edit mode, we have 2x matches - 1 items (matches + insert slots between them)
	const virtualCount = isEditMode ? matches.length * 2 - 1 : matches.length;

	const virtualizer = useVirtualizer({
		count: virtualCount,
		getScrollElement: () => parentRef.current,
		estimateSize: () => (isEditMode ? 140 : 100),
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

	// Reset edit mode when leaving page or when season is locked
	useEffect(() => {
		if (isSeasonLocked) {
			setIsEditMode(false);
		}
	}, [isSeasonLocked]);

	// Get match at virtual index (accounting for insert slots in edit mode)
	const getMatchAtVirtualIndex = (virtualIndex: number): (typeof matches)[0] | null => {
		if (!isEditMode) {
			return matches[virtualIndex] || null;
		}
		// In edit mode: even indices are matches, odd indices are insert slots
		if (virtualIndex % 2 === 1) {
			return null; // This is an insert slot
		}
		return matches[virtualIndex / 2] || null;
	};

	// Check if this virtual index is an insert slot
	const isInsertSlotAtIndex = (virtualIndex: number): boolean => {
		if (!isEditMode) return false;
		return virtualIndex % 2 === 1;
	};

	// Get the match that comes before an insert slot
	const getMatchBeforeInsertSlot = (virtualIndex: number): (typeof matches)[0] | null => {
		if (!isEditMode || virtualIndex % 2 === 0) return null;
		const matchIndex = Math.floor(virtualIndex / 2);
		return matches[matchIndex] || null;
	};

	const handleInsertClick = (match: (typeof matches)[0]) => {
		setInsertAfterMatch(match);
		setIsInsertDialogOpen(true);
	};

	const handleInsertDialogClose = () => {
		setIsInsertDialogOpen(false);
		setInsertAfterMatch(null);
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
							<div className="flex items-center justify-between">
								<div className="text-2xl font-bold">{total}</div>
								{canEditMatches && !isSeasonLocked && (
									<Button
										variant={isEditMode ? "default" : "outline"}
										size="sm"
										onClick={() => setIsEditMode(!isEditMode)}
										className="gap-1.5"
									>
										<HugeiconsIcon icon={PencilEdit01Icon} className="size-3.5" />
										<span className="hidden sm:inline">{isEditMode ? "Done" : "Edit"}</span>
									</Button>
								)}
							</div>
							<p className="text-xs text-muted-foreground mt-1">All matches in this season</p>
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
								{!isEditMode && canDeleteMatches && !isSeasonLocked && latestMatch && (
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
											// Check if this is an insert slot in edit mode
											if (isInsertSlotAtIndex(virtualItem.index)) {
												const matchBefore = getMatchBeforeInsertSlot(virtualItem.index);
												if (!matchBefore) return null;

												return (
													<div
														key={`insert-${matchBefore.id}`}
														data-index={virtualItem.index}
														ref={virtualizer.measureElement}
														style={{
															position: "absolute",
															top: 0,
															left: 0,
															width: "100%",
															transform: `translateY(${virtualItem.start}px)`,
														}}
														className="py-2"
													>
														<Button
															variant="outline"
															size="sm"
															className="w-full h-10 border-dashed border-2 hover:border-primary hover:bg-primary/5 gap-2"
															onClick={() => handleInsertClick(matchBefore)}
														>
															<HugeiconsIcon icon={Add01Icon} className="size-4" />
															<span className="text-sm">Add match here</span>
														</Button>
													</div>
												);
											}

											const match = getMatchAtVirtualIndex(virtualItem.index);
											if (!match) return null;

											const isLastMatch = virtualItem.index === virtualCount - 1;

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
													className={cn(
														"py-3 px-3",
														isEditMode
															? "bg-card border rounded-lg shadow-sm"
															: "border-b border-border/50 last:border-b-0"
													)}
												>
													<div className="flex items-center gap-3">
														<div className="flex-1 min-w-0">
															<MatchRow
																match={match}
																seasonSlug={seasonSlug}
																seasonId={seasonId ?? ""}
																compact={isEditMode}
															/>
														</div>
														{isEditMode && (
															<Button
																variant="secondary"
																size="sm"
																className="h-9 w-9 p-0 shrink-0"
																onClick={() => {
																	setEditMatch(match);
																	setIsEditDialogOpen(true);
																}}
																data-testid={`edit-match-${match.id}`}
																aria-label={`Edit match ${match.homeTeam.players.map(p => p.name).join(' & ')} vs ${match.awayTeam.players.map(p => p.name).join(' & ')}`}
															>
																<HugeiconsIcon icon={PencilEdit01Icon} className="size-4" />
															</Button>
														)}
													</div>
													{isEditMode && isLastMatch && canEditMatches && !isSeasonLocked && (
														<div className="mt-3 pt-3 border-t border-border">
															<Button
																variant="outline"
																size="sm"
																className="w-full h-10 border-dashed border-2 hover:border-primary hover:bg-primary/5 gap-2"
																onClick={() => handleInsertClick(match)}
															>
																<HugeiconsIcon icon={Add01Icon} className="size-4" />
																<span className="text-sm">Add match at the end</span>
															</Button>
														</div>
													)}
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
