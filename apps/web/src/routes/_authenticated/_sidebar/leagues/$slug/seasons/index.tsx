import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { authClient } from "@/lib/auth-client";
import { trpcClient } from "@/lib/trpc";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	AwardIcon,
	Award01Icon,
	Target01Icon,
	Clock01Icon,
	Add01Icon,
	SecurityLockIcon,
	Archive01Icon,
	CheckmarkCircle02Icon,
	PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { RowCard } from "@/components/ui/row-card";
import { useQuery } from "@tanstack/react-query";
import { CreateSeasonForm } from "@/components/seasons/create-season-form";
import { EditSeasonForm } from "@/components/seasons/edit-season-form";
import { CloseSeasonDialog } from "@/components/seasons/close-season-dialog";

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/seasons/")({
	component: SeasonsPage,
	loader: async ({ params }) => {
		return { slug: params.slug };
	},
});

interface Season {
	id: string;
	name: string;
	slug: string;
	initialScore: number;
	scoreType: "elo" | "3-1-0" | "elo-individual-vs-team";
	kFactor: number;
	startDate: Date;
	endDate?: Date | null;
	rounds?: number | null;
	archived: boolean;
	closed: boolean;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
	leagueId: string;
	createdBy: string;
	updatedBy: string;
}

function truncateSlug(slug: string, maxLength = 10): string {
	if (slug.length <= maxLength) return slug;
	return `${slug.slice(0, maxLength)}...`;
}

function formatDate(date: Date) {
	return new Date(date).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function getSeasonStatus(season: Season) {
	if (season.archived) return "archived";
	if (season.closed) return "locked";

	const now = new Date();
	const startDate = new Date(season.startDate);
	const endDate = season.endDate ? new Date(season.endDate) : null;

	if (startDate > now) return "upcoming";
	if (endDate && endDate < now) return "ended";
	return "active";
}

function getStatusIcon(status: string) {
	switch (status) {
		case "active":
			return <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 text-green-500" />;
		case "upcoming":
			return <HugeiconsIcon icon={Clock01Icon} className="size-4 text-blue-500" />;
		case "ended":
			return <HugeiconsIcon icon={AwardIcon} className="size-4 text-amber-500" />;
		case "locked":
			return <HugeiconsIcon icon={SecurityLockIcon} className="size-4 text-gray-500" />;
		case "archived":
			return <HugeiconsIcon icon={Archive01Icon} className="size-4 text-gray-400" />;
		default:
			return <HugeiconsIcon icon={Clock01Icon} className="size-4 text-gray-500" />;
	}
}

function getScoreTypeIcon(scoreType: string) {
	switch (scoreType) {
		case "elo":
			return Award01Icon; // Trophy for ELO
		case "3-1-0":
			return Target01Icon; // Dart for 3-1-0 Points System
		default:
			return AwardIcon; // Fallback
	}
}

function getScoreTypeColor(scoreType: string) {
	switch (scoreType) {
		case "elo":
			return "text-emerald-500"; // Green for ELO
		case "3-1-0":
			return "text-blue-500"; // Blue for 3-1-0 Points System
		default:
			return "text-primary"; // Fallback
	}
}

function getScoreTypeBgColor(scoreType: string) {
	switch (scoreType) {
		case "elo":
			return "bg-emerald-500/10"; // Green background for ELO
		case "3-1-0":
			return "bg-blue-500/10"; // Blue background for 3-1-0 Points System
		default:
			return "bg-primary/10"; // Fallback
	}
}

function getStatusColor(status: string) {
	switch (status) {
		case "active":
			return "bg-green-500/10 text-green-600 border-green-500/20";
		case "upcoming":
			return "bg-blue-500/10 text-blue-600 border-blue-500/20";
		case "ended":
			return "bg-amber-500/10 text-amber-600 border-amber-500/20";
		case "locked":
			return "bg-gray-500/10 text-gray-600 border-gray-500/20";
		case "archived":
			return "bg-gray-400/10 text-gray-500 border-gray-400/20";
		default:
			return "bg-gray-500/10 text-gray-600 border-gray-500/20";
	}
}

function SeasonsPage() {
	const { slug } = Route.useLoaderData();
	const navigate = useNavigate();
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
	const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);

	const { data: activeMember } = authClient.useActiveMember();
	const role = activeMember?.role;
	const canAccess = role === "owner" || role === "editor" || role === "member" || role === "viewer";
	const canCreate = role === "owner" || role === "editor";

	useEffect(() => {
		if (role && !canAccess) {
			toast.error("You do not have permission to access seasons. Redirecting...", {
				duration: 3000,
			});
			setTimeout(() => {
				void navigate({ to: "/leagues/$slug", params: { slug } });
			}, 100);
		}
	}, [role, canAccess, navigate, slug]);

	const {
		data: seasons,
		isLoading,
		refetch,
	} = useQuery({
		queryKey: ["seasons", slug],
		queryFn: async () => {
			return await trpcClient.season.getAll.query();
		},
		enabled: canAccess,
	});

	const seasonsData = useMemo(() => {
		if (!seasons) return [];
		return seasons.sort(
			(a: Season, b: Season) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
		);
	}, [seasons]);

	const stats = useMemo(() => {
		if (!seasonsData) return { total: 0, active: 0, upcoming: 0, ended: 0 };

		const statusCounts = seasonsData.reduce(
			(acc: Record<string, number>, season: Season) => {
				const status = getSeasonStatus(season);
				acc[status] = (acc[status] || 0) + 1;
				acc.total += 1;
				return acc;
			},
			{ total: 0, active: 0, upcoming: 0, ended: 0, closed: 0, archived: 0 } as Record<
				string,
				number
			>
		);

		return statusCounts;
	}, [seasonsData]);

	if (!canAccess) {
		return null;
	}

	return (
		<>
			<Header
				rightContent={
					canCreate && (
						<GlowButton
							icon={Add01Icon}
							size="sm"
							className="gap-1.5"
							glowColor={glowColors.blue}
							onClick={() => setIsCreateDialogOpen(true)}
						>
							Season
						</GlowButton>
					)
				}
			>
				<SidebarTrigger className="-ml-1" />
				<Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem className="hidden md:block">
							<BreadcrumbLink href="#">League</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden md:block" />
						<BreadcrumbItem>
							<BreadcrumbLink href={`/leagues/${slug}`}>{truncateSlug(slug)}</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator className="hidden md:block" />
						<BreadcrumbItem>
							<BreadcrumbPage>Seasons</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</Header>
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<div className="grid gap-3 md:grid-cols-3">
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.1),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">Active Seasons</CardTitle>
							<HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 text-emerald-600" />
						</CardHeader>
						<CardContent className="relative">
							<div className="text-2xl font-bold">{stats.active}</div>
							<p className="text-xs text-muted-foreground">Currently running competitions</p>
						</CardContent>
					</Card>
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.1),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">Upcoming</CardTitle>
							<HugeiconsIcon icon={Clock01Icon} className="size-4 text-blue-600" />
						</CardHeader>
						<CardContent className="relative">
							<div className="text-2xl font-bold">{stats.upcoming}</div>
							<p className="text-xs text-muted-foreground">Scheduled to start</p>
						</CardContent>
					</Card>
					<Card className="relative overflow-hidden">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.1),transparent_60%)]" />
						<CardHeader className="relative flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">Total Seasons</CardTitle>
							<HugeiconsIcon icon={AwardIcon} className="size-4 text-amber-600" />
						</CardHeader>
						<CardContent className="relative">
							<div className="text-2xl font-bold">{stats.total}</div>
							<p className="text-xs text-muted-foreground">All competitions to date</p>
						</CardContent>
					</Card>
				</div>
				<div className="bg-muted/50 min-h-[100vh] flex-1 md:min-h-min p-6">
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-medium">Seasons</h3>
							<span className="text-sm text-muted-foreground">
								Showing {seasonsData.length} seasons
							</span>
						</div>
						{isLoading ? (
							<div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
								Loading seasons...
							</div>
						) : seasonsData.length === 0 ? (
							<div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm">
									<HugeiconsIcon icon={AwardIcon} className="size-5" />
								</div>
								<p>No seasons created yet</p>
								{canCreate && (
									<GlowButton
										icon={Add01Icon}
										variant="outline"
										className="gap-1.5"
										onClick={() => setIsCreateDialogOpen(true)}
									>
										Create First Season
									</GlowButton>
								)}
							</div>
						) : (
							<div className="divide-y divide-border border">
								{seasonsData.map((season) => {
									const status = getSeasonStatus(season);
									const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

									return (
										<RowCard
											key={season.id}
											icon={
												<div
													className={`flex h-10 w-10 items-center justify-center rounded-lg ${getScoreTypeBgColor(season.scoreType)}`}
												>
													<HugeiconsIcon
														icon={getScoreTypeIcon(season.scoreType)}
														className={`size-5 ${getScoreTypeColor(season.scoreType)}`}
													/>
												</div>
											}
											title={season.name}
											subtitle={
												<div className="flex items-center gap-1.5 min-w-0">
													<span className="capitalize shrink-0">{season.scoreType}</span>
													<span className="shrink-0">•</span>
													<span className="truncate">{formatDate(season.startDate)}</span>
													{season.endDate && (
														<>
															<span className="shrink-0">-</span>
															<span className="truncate">{formatDate(season.endDate)}</span>
														</>
													)}
												</div>
											}
											onClick={() => {
												navigate({
													to: "/leagues/$slug/seasons/$seasonSlug",
													params: { slug, seasonSlug: season.slug },
												});
											}}
										>
											<div
												className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-medium ${getStatusColor(
													status
												)}`}
											>
												{getStatusIcon(status)}
												<span className="hidden sm:inline">{statusLabel}</span>
											</div>
											{canCreate && !season.archived && (
												<div className="flex items-center gap-1">
													<Button
														variant="ghost"
														size="sm"
														onClick={(e) => {
															e.stopPropagation();
															setSelectedSeason(season);
															setIsEditDialogOpen(true);
														}}
													>
														<span className="hidden sm:inline">Edit Season</span>
														<span className="sm:hidden">
															<HugeiconsIcon icon={PencilEdit01Icon} className="size-4" />
														</span>
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onClick={(e) => {
															e.stopPropagation();
															setSelectedSeason(season);
															setIsCloseDialogOpen(true);
														}}
													>
														<span className="hidden sm:inline">
															{season.closed ? "Unlock Season" : "Lock Season"}
														</span>
														<span className="sm:hidden">
															<HugeiconsIcon icon={SecurityLockIcon} className="size-4" />
														</span>
													</Button>
												</div>
											)}
										</RowCard>
									);
								})}
							</div>
						)}
					</div>
				</div>
			</div>
			<CreateSeasonForm
				isOpen={isCreateDialogOpen}
				onClose={() => setIsCreateDialogOpen(false)}
				onSuccess={() => void refetch()}
			/>
			<EditSeasonForm
				isOpen={isEditDialogOpen}
				onClose={() => {
					setIsEditDialogOpen(false);
					setSelectedSeason(null);
				}}
				onSuccess={() => {
					void refetch();
					setSelectedSeason(null);
				}}
				season={selectedSeason}
			/>
			<CloseSeasonDialog
				isOpen={isCloseDialogOpen}
				onClose={() => {
					setIsCloseDialogOpen(false);
					setSelectedSeason(null);
				}}
				onSuccess={() => {
					void refetch();
					setSelectedSeason(null);
				}}
				season={selectedSeason}
			/>
		</>
	);
}
