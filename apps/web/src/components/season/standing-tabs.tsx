import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "@/lib/trpc";
import { OverviewCard } from "./overview-card";
import { Standing } from "./standing";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface StandingTabsProps {
	seasonId: string;
	seasonSlug: string;
}

interface TeamStandingItem {
	id: string;
	seasonId: string;
	leagueTeamId: string;
	score: number;
	name: string;
}

function TeamStanding({ seasonSlug }: { seasonSlug: string }) {
	const { data, isLoading } = useQuery<TeamStandingItem[]>({
		queryKey: ["seasonTeam", "standing", seasonSlug],
		queryFn: async () => {
			return [];
		},
	});

	if (isLoading) {
		return <Skeleton className="w-full h-80" />;
	}

	if (!data?.length) {
		return (
			<div className="flex items-center justify-center h-40 text-muted-foreground">
				No team data available
			</div>
		);
	}

	return (
		<div className="rounded-md">
			<Table>
				<TableHeader className="text-xs">
					<TableRow>
						<TableHead>Team</TableHead>
						<TableHead className="text-center">Pts</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody className="text-sm">
					{data.map((item) => (
						<TableRow key={item.id} className="h-14">
							<TableCell>
								<span className="font-medium">{item.name}</span>
							</TableCell>
							<TableCell className="text-center font-bold">{item.score}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

export function StandingTabs({ seasonId, seasonSlug }: StandingTabsProps) {
	const { data: season } = useQuery({
		queryKey: ["season", seasonSlug],
		queryFn: async () => {
			return await trpcClient.season.getBySlug.query({ seasonSlug });
		},
	});

	const canHaveTeams = season?.scoreType !== "3-1-0";
	const hasTeams = false;
	const showTeamStandings = canHaveTeams && hasTeams;

	return (
		<OverviewCard title="Standings">
			{showTeamStandings ? (
				<div className="space-y-6">
					<div>
						<h3 className="text-sm font-medium text-muted-foreground mb-3">Individual</h3>
						<Standing seasonId={seasonId} seasonSlug={seasonSlug} />
					</div>
					<div>
						<h3 className="text-sm font-medium text-muted-foreground mb-3">Team</h3>
						<TeamStanding seasonSlug={seasonSlug} />
					</div>
				</div>
			) : (
				<Standing seasonId={seasonId} seasonSlug={seasonSlug} />
			)}
		</OverviewCard>
	);
}
