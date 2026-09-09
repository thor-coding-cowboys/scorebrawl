import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc";
import { truncateSlug } from "@/lib/utils";
import { achievementCatalog, type AchievementType } from "@/lib/achievements";
import { HugeiconsIcon } from "@hugeicons/react";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/achievements/")({
	component: LeagueAchievementsPage,
	loader: async ({ params }) => {
		return { slug: params.slug };
	},
});

type BoardRow = {
	playerId: string;
	type: AchievementType;
	createdAt: Date;
	name: string;
	image: string | null;
};

type PlayerStats = {
	playerId: string;
	name: string;
	image: string | null;
	count: number;
	types: AchievementType[];
};

function LeagueAchievementsPage() {
	const { slug } = Route.useLoaderData();
	const trpc = useTRPC();

	const { data: rows, isLoading } = useQuery(trpc.achievement.getLeagueBoard.queryOptions());

	const byType = new Map<string, BoardRow[]>();
	const byPlayer = new Map<string, PlayerStats>();

	for (const row of rows ?? []) {
		const typeList = byType.get(row.type) ?? [];
		typeList.push(row);
		byType.set(row.type, typeList);

		const existing = byPlayer.get(row.playerId);
		if (existing) {
			existing.count += 1;
			existing.types.push(row.type);
		} else {
			byPlayer.set(row.playerId, {
				playerId: row.playerId,
				name: row.name,
				image: row.image,
				count: 1,
				types: [row.type],
			});
		}
	}

	const decorated = [...byPlayer.values()].sort((a, b) => b.count - a.count);

	return (
		<>
			<Header
				breadcrumbs={[
					{ name: "Leagues", href: "/leagues" },
					{ name: truncateSlug(slug), href: `/leagues/${slug}` },
					{ name: "Achievements" },
				]}
			/>
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<Card>
					<CardHeader>
						<CardTitle>Most Decorated Players</CardTitle>
						<CardDescription>Ranked by total achievements earned</CardDescription>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="space-y-3">
								{Array.from({ length: 3 }).map((_, i) => (
									<div key={`decorated-skeleton-${String(i)}`} className="flex items-center gap-3">
										<Skeleton className="h-10 w-10 rounded-lg" />
										<Skeleton className="h-4 w-40" />
									</div>
								))}
							</div>
						) : decorated.length === 0 ? (
							<p className="text-center text-muted-foreground py-8">
								No achievements earned in this league yet
							</p>
						) : (
							<div className="space-y-3">
								{decorated.map((p, index) => (
									<Link
										key={p.playerId}
										to="/leagues/$slug/players/$leaguePlayerId"
										params={{ slug, leaguePlayerId: p.playerId }}
										className="flex items-center gap-3 rounded-lg hover:bg-muted/50 p-2 transition-colors"
									>
										<span className="w-6 text-sm font-bold text-muted-foreground">{index + 1}</span>
										<AvatarWithFallback src={p.image} name={p.name} size="md" />
										<div className="flex-1 min-w-0">
											<p className="font-medium truncate">{p.name}</p>
											<p className="text-sm text-muted-foreground truncate">
												{p.types
													.map((t) => achievementCatalog[t]?.name)
													.filter(Boolean)
													.join(" · ")}
											</p>
										</div>
										<span className="text-lg font-bold">{p.count}</span>
									</Link>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>League Achievements</CardTitle>
						<CardDescription>Who holds each achievement</CardDescription>
					</CardHeader>
					<CardContent>
						{isLoading ? (
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
								{Array.from({ length: 6 }).map((_, i) => (
									<Skeleton key={`board-skeleton-${String(i)}`} className="h-24 w-full" />
								))}
							</div>
						) : (
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
								{Object.entries(achievementCatalog).map(([type, meta]) => {
									const holders = byType.get(type) ?? [];
									return (
										<div
											key={type}
											className="rounded-lg border p-4 flex flex-col items-start gap-3"
										>
											<div className="flex items-center gap-3">
												<div
													className={
														holders.length > 0
															? "text-primary"
															: "text-muted-foreground/40 grayscale"
													}
												>
													<HugeiconsIcon icon={meta.icon} className="size-6" />
												</div>
												<div>
													<p className="text-sm font-medium">{meta.name}</p>
													<p className="text-xs text-muted-foreground">{meta.description}</p>
												</div>
											</div>
											{holders.length === 0 ? (
												<p className="text-xs text-muted-foreground">Nobody yet</p>
											) : (
												<div className="flex -space-x-2">
													{holders.map((h) => (
														<AvatarWithFallback
															key={`${h.playerId}-${h.type}`}
															src={h.image}
															name={h.name}
															size="sm"
															className="rounded-full ring-2 ring-background"
														/>
													))}
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</>
	);
}
