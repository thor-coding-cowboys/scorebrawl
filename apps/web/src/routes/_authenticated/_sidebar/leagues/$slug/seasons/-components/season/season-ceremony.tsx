import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Add01Icon, Share01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { SeasonRecap, type SeasonRecapInfo } from "@/components/season-recap/season-recap";
import { Button } from "@/components/ui/button";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc";
import { CreateSeasonForm } from "../seasons/create-season-form";

export function SeasonCeremony({
	seasonSlug,
	season,
	leagueSlug,
	canStartNextSeason,
	onShare,
}: {
	seasonSlug: string;
	season: SeasonRecapInfo;
	leagueSlug: string;
	canStartNextSeason: boolean;
	onShare?: () => void;
}) {
	const trpc = useTRPC();
	const navigate = useNavigate();
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const { data: summary } = useQuery(trpc.season.getSummary.queryOptions({ seasonSlug }));

	if (!summary) return <Skeleton className="h-[760px] w-full" />;

	const hasActions = canStartNextSeason || !!onShare;

	return (
		<>
			<SeasonRecap
				summary={summary}
				season={season}
				action={
					hasActions && (
						<div className="flex flex-wrap items-center gap-2">
							{canStartNextSeason && (
								<GlowButton
									icon={Add01Icon}
									glowColor={glowColors.amber}
									size="sm"
									className="gap-1.5"
									onClick={() => setIsCreateOpen(true)}
									data-testid="start-next-season-button"
								>
									Start next season
								</GlowButton>
							)}
							{onShare && (
								<Button
									size="sm"
									variant="outline"
									className="gap-1.5 bg-background/60 backdrop-blur-sm"
									onClick={onShare}
									data-testid="share-recap-button"
								>
									<HugeiconsIcon icon={Share01Icon} className="size-3.5" />
									Share recap
								</Button>
							)}
						</div>
					)
				}
			/>
			{canStartNextSeason && (
				<CreateSeasonForm
					isOpen={isCreateOpen}
					onClose={() => setIsCreateOpen(false)}
					onSuccess={(newSeasonSlug) => {
						void navigate({
							to: "/leagues/$slug/seasons/$seasonSlug",
							params: { slug: leagueSlug, seasonSlug: newSeasonSlug },
						});
					}}
				/>
			)}
		</>
	);
}
