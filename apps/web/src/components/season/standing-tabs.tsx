import { OverviewCard } from "./overview-card";
import { Standing } from "./standing";

interface StandingTabsProps {
	seasonId: string;
	seasonSlug: string;
	leagueSlug?: string;
}

export function StandingTabs({ seasonId, seasonSlug, leagueSlug }: StandingTabsProps) {
	return (
		<OverviewCard title="Standings">
			<Standing seasonId={seasonId} seasonSlug={seasonSlug} leagueSlug={leagueSlug} />
		</OverviewCard>
	);
}
