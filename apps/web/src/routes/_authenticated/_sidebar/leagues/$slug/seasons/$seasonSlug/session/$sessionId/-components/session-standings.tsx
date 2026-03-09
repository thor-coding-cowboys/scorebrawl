import { useState, useMemo } from "react";
import { OverviewCard } from "../../../../-components/season/overview-card";
import { Standing } from "../../../../-components/season/standing";
import { TeamStanding } from "../../../../-components/season/team-standing";
import { useStandings, useTeamStandings } from "@/lib/collections";
import { cn } from "@/lib/utils";
import type { SessionPlayer } from "./session-types";

const STANDING_TABS = ["Standings", "Team Standings"] as const;

export function SessionStandings({
	seasonSlug,
	leagueSlug,
	sessionPlayers,
}: {
	seasonSlug: string;
	leagueSlug: string;
	sessionPlayers: SessionPlayer[];
}) {
	const { teamStandings } = useTeamStandings(seasonSlug);
	const { standings } = useStandings(seasonSlug);
	const hasTeams = teamStandings.length > 0;
	const [activeTab, setActiveTab] = useState(0);

	const highlightSeasonPlayerIds = useMemo(
		() => new Set(sessionPlayers.map((p) => p.seasonPlayerId)),
		[sessionPlayers]
	);

	const highlightLeaguePlayerIds = useMemo(() => {
		const leagueIds = new Set<string>();
		for (const s of standings) {
			if (highlightSeasonPlayerIds.has(s.id)) {
				leagueIds.add(s.playerId);
			}
		}
		return leagueIds;
	}, [standings, highlightSeasonPlayerIds]);

	const tabToggle = hasTeams ? (
		<div className="relative grid grid-cols-2 rounded-lg bg-muted p-1">
			<div
				className="absolute top-1 bottom-1 w-[calc(50%-2px)] rounded-md bg-background shadow-sm transition-all duration-200 ease-out"
				style={{ left: activeTab === 0 ? 4 : "calc(50% + 2px)" }}
			/>
			{STANDING_TABS.map((label, i) => (
				<button
					key={label}
					type="button"
					onClick={() => setActiveTab(i)}
					className={cn(
						"relative z-10 rounded-md px-3 py-1 text-sm font-medium transition-colors duration-200",
						i === activeTab ? "text-foreground" : "text-muted-foreground hover:text-foreground"
					)}
				>
					{label}
				</button>
			))}
		</div>
	) : (
		"Standings"
	);

	return (
		<OverviewCard title={tabToggle}>
			{!hasTeams || activeTab === 0 ? (
				<Standing seasonSlug={seasonSlug} highlightPlayerIds={highlightSeasonPlayerIds} />
			) : (
				<TeamStanding
					seasonSlug={seasonSlug}
					leagueSlug={leagueSlug}
					highlightPlayerIds={highlightLeaguePlayerIds}
				/>
			)}
		</OverviewCard>
	);
}
