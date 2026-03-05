import { OverviewCard } from "./overview-card";
import { Standing } from "./standing";
import { TeamStanding } from "./team-standing";
import { useTeamStandings } from "@/lib/collections";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface StandingTabsProps {
	seasonSlug: string;
	leagueSlug?: string;
}

const TABS = ["Standings", "Team Standings"] as const;

export function StandingTabs({ seasonSlug, leagueSlug }: StandingTabsProps) {
	const { teamStandings } = useTeamStandings(seasonSlug);
	const hasTeams = teamStandings.length > 0;
	const [activeTab, setActiveTab] = useState(0);

	if (!hasTeams) {
		return (
			<OverviewCard title="Standings">
				<Standing seasonSlug={seasonSlug} leagueSlug={leagueSlug} />
			</OverviewCard>
		);
	}

	return (
		<>
			<div className="md:hidden">
				<OverviewCard
					title={
						<div className="flex justify-center w-full">
							<div className="relative grid grid-cols-2 rounded-lg bg-muted p-1">
								<div
									className="absolute top-1 bottom-1 w-[calc(50%-2px)] rounded-md bg-background shadow-sm transition-all duration-200 ease-out"
									style={{ left: activeTab === 0 ? 4 : "calc(50% + 2px)" }}
								/>
								{TABS.map((label, i) => (
									<button
										key={label}
										type="button"
										onClick={() => setActiveTab(i)}
										className={cn(
											"relative z-10 rounded-md px-3 py-1 text-sm font-medium transition-colors duration-200",
											i === activeTab
												? "text-foreground"
												: "text-muted-foreground hover:text-foreground"
										)}
									>
										{label}
									</button>
								))}
							</div>
						</div>
					}
				>
					{activeTab === 0 ? (
						<Standing seasonSlug={seasonSlug} leagueSlug={leagueSlug} />
					) : (
						<TeamStanding seasonSlug={seasonSlug} leagueSlug={leagueSlug} />
					)}
				</OverviewCard>
			</div>
			<div className="hidden md:block">
				<OverviewCard title="Standings">
					<Standing seasonSlug={seasonSlug} leagueSlug={leagueSlug} />
				</OverviewCard>
			</div>
		</>
	);
}
