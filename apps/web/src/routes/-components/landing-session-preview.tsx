import {
	ArrowTurnBackwardIcon,
	Award01Icon,
	BarChartIcon,
	CheckmarkCircle01Icon,
	Crown02Icon,
	FireIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { SessionMatch, SessionPlayer } from "@coding-cowboys/scorebrawl-core/session";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { DashboardCard } from "@/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/season/dashboard-card";
import {
	QueueList,
	ScoreStepper,
	TeamRosterCard,
} from "@/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/session/$sessionId/-components/score-stepper";

export const landingAvatar = (name: string) =>
	`/landing/avatars/${name.split(" ")[0]?.toLowerCase()}.svg`;

const player = (
	id: string,
	displayName: string,
	score: number,
	status: SessionPlayer["status"],
	queuePosition: number,
	gamesPlayedThisSession: number,
	consecutiveGames: number
): SessionPlayer => ({
	id,
	seasonPlayerId: id,
	displayName,
	playerImage: landingAvatar(displayName),
	score,
	status,
	queuePosition,
	gamesPlayedThisSession,
	consecutiveGames,
	userId: null,
});

const PLAYERS: SessionPlayer[] = [
	player("lena", "Lena Haugen", 1412, "playing", 0, 6, 4),
	player("priya", "Priya Raman", 1247, "playing", 0, 5, 4),
	player("omar", "Omar Diallo", 1318, "playing", 0, 5, 1),
	player("jonas", "Jonas Becker", 1183, "playing", 0, 4, 1),
	player("sofia", "Sofia Moreno", 1096, "waiting", 1, 4, 0),
	player("theo", "Theo Laurent", 1152, "waiting", 2, 3, 0),
];

const match = (
	matchNumber: number,
	home: string[],
	away: string[],
	result: SessionMatch["result"]
): SessionMatch => ({
	id: `m${matchNumber}`,
	matchNumber,
	homePlayerIds: home,
	awayPlayerIds: away,
	result,
	matchId: null,
	homeSessionScore: 0,
	awaySessionScore: 0,
	selectedHomePlayerIds: null,
	selectedAwayPlayerIds: null,
});

const MATCHES: SessionMatch[] = [
	match(8, ["lena", "priya"], ["sofia", "theo"], "home"),
	match(9, ["lena", "priya"], ["jonas", "omar"], "home"),
	match(10, ["lena", "priya"], ["sofia", "theo"], "home"),
	match(11, ["lena", "priya"], ["omar", "jonas"], "home"),
	match(12, ["lena", "priya"], ["omar", "jonas"], null),
];

const byId = (id: string) => PLAYERS.find((p) => p.id === id);
const homePlayers = PLAYERS.filter((p) => ["lena", "priya"].includes(p.id));
const awayPlayers = PLAYERS.filter((p) => ["omar", "jonas"].includes(p.id));

const LatestResultRow = ({ ids, won }: { ids: string[]; won: boolean }) => (
	<div className="flex items-center justify-between">
		<div className="flex min-w-0 items-center gap-2">
			<div className="flex -space-x-1">
				{ids.map((id) => (
					<AvatarWithFallback
						key={id}
						src={landingAvatar(id)}
						name={byId(id)?.displayName}
						size="sm"
					/>
				))}
			</div>
			<span
				className={
					won ? "truncate text-xs font-semibold" : "text-muted-foreground truncate text-xs"
				}
			>
				{ids.map((id) => byId(id)?.displayName.split(" ")[0]).join(" & ")}
			</span>
		</div>
		<span
			className={won ? "font-mono text-sm font-bold" : "text-muted-foreground font-mono text-sm"}
		>
			{won ? "W" : "L"}
		</span>
	</div>
);

export const SessionPreview = () => {
	return (
		<div inert className="flex flex-col gap-4 text-left">
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<DashboardCard
					title="Hot Streak"
					icon={FireIcon}
					glowColor="card-glow-red"
					iconColor="text-red-600"
				>
					<div className="flex min-w-0 items-center gap-3">
						<AvatarWithFallback src={landingAvatar("Lena")} name="Lena Haugen" size="md" />
						<div className="flex min-w-0 flex-1 flex-col">
							<span className="truncate text-sm font-medium">Lena Haugen</span>
							<div className="flex items-center gap-1.5">
								<span className="flex items-center gap-0.5">
									{[1, 2, 3, 4].map((dot) => (
										<span key={dot} className="size-1.5 rounded-full bg-emerald-500" />
									))}
								</span>
								<span className="text-muted-foreground text-xs">4 wins in a row</span>
							</div>
						</div>
					</div>
				</DashboardCard>
				<DashboardCard
					title="Session MVP"
					icon={Crown02Icon}
					glowColor="card-glow-amber"
					iconColor="text-amber-600"
				>
					<div className="flex min-w-0 items-center gap-3">
						<AvatarWithFallback src={landingAvatar("Lena")} name="Lena Haugen" size="md" />
						<div className="flex min-w-0 flex-1 flex-col">
							<span className="truncate text-sm font-medium">Lena Haugen</span>
							<span className="text-muted-foreground text-xs">1412 pts · 6g</span>
						</div>
					</div>
				</DashboardCard>
				<DashboardCard
					title="Latest Result"
					icon={Award01Icon}
					glowColor="card-glow-blue"
					iconColor="text-blue-600"
				>
					<div className="space-y-1.5">
						<LatestResultRow ids={["lena", "priya"]} won />
						<LatestResultRow ids={["omar", "jonas"]} won={false} />
					</div>
				</DashboardCard>
				<DashboardCard
					title="Session Info"
					icon={BarChartIcon}
					glowColor="card-glow-emerald"
					iconColor="text-emerald-600"
				>
					<div className="grid grid-cols-3 gap-2 text-center">
						<div>
							<div className="text-lg font-bold">11</div>
							<div className="text-muted-foreground text-xs">Matches</div>
						</div>
						<div>
							<div className="text-lg font-bold">6</div>
							<div className="text-muted-foreground text-xs">Players</div>
						</div>
						<div>
							<div className="text-xs leading-6 font-bold">Winner stays</div>
							<div className="text-muted-foreground text-xs">Mode</div>
						</div>
					</div>
				</DashboardCard>
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<Card className="p-4">
					<div className="mb-4 flex items-center justify-between">
						<h3 className="font-mono text-sm font-bold">Match #12</h3>
						<Badge variant="secondary" className="text-xs">
							In Progress
						</Badge>
					</div>
					<div className="flex flex-col gap-4">
						<div className="bg-muted/30">
							<div className="grid grid-cols-2">
								<ScoreStepper
									label="Home"
									score={7}
									onIncrement={() => undefined}
									onDecrement={() => undefined}
								/>
								<ScoreStepper
									label="Away"
									score={5}
									onIncrement={() => undefined}
									onDecrement={() => undefined}
								/>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<TeamRosterCard label="Home" players={homePlayers} />
							<TeamRosterCard label="Away" players={awayPlayers} />
						</div>
						<div className="flex flex-col gap-2">
							<GlowButton glowColor={glowColors.blue} className="w-full gap-2">
								<HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
								Record Result
							</GlowButton>
							<Button variant="ghost" className="text-muted-foreground w-full gap-1.5">
								<HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-4" />
								Cancel Match
							</Button>
						</div>
					</div>
				</Card>
				<Card className="p-4">
					<div className="px-4 pt-1 pb-2">
						<span className="text-sm font-semibold">Players</span>
					</div>
					<QueueList session={{ players: PLAYERS, matches: MATCHES }} />
				</Card>
			</div>
		</div>
	);
};
