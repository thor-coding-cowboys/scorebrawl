import { OverviewCard } from "./overview-card";
import { Standing } from "./standing";

interface StandingTabsProps {
	seasonSlug: string;
	leagueSlug?: string;
}

export function StandingTabs({ seasonSlug, leagueSlug }: StandingTabsProps) {
	return (
		<OverviewCard title="Standings">
			<Standing seasonSlug={seasonSlug} leagueSlug={leagueSlug} />
		</OverviewCard>
	);
}
