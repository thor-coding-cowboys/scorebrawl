import { OverviewCard } from "./overview-card";
import { Standing } from "./standing";

interface StandingTabsProps {
	seasonId: string;
	seasonSlug: string;
}

export function StandingTabs({ seasonId, seasonSlug }: StandingTabsProps) {
	return (
		<OverviewCard title="Standings">
			<Standing seasonId={seasonId} seasonSlug={seasonSlug} />
		</OverviewCard>
	);
}
