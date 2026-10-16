import {
	Add01Icon,
	AiChat02Icon,
	ArrowRight02Icon,
	Award01Icon,
	BarChartIcon,
	Calendar03Icon,
	ChampionIcon,
	ChartLineData02Icon,
	ComputerIcon,
	FireIcon,
	GithubIcon,
	Home01Icon,
	Medal01Icon,
	PlayIcon,
	SmartPhone01Icon,
	SnowIcon,
	UserGroupIcon,
	UserIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
	calculateStreak,
	type StandingFormResult,
} from "@coding-cowboys/scorebrawl-core/presentation";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { BrandMark } from "@/components/brand-mark";
import { StreakAvatar } from "@/components/streak-avatar";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { FormDots } from "@/components/ui/form-dots";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useSession } from "@/hooks/useSession";
import { DashboardCard } from "@/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/season/dashboard-card";
import { landingAvatar, SessionPreview } from "./landing-session-preview";
import { cn } from "@/lib/utils";

const GITHUB_URL = "https://github.com/thor-coding-cowboys/scorebrawl";

type Player = {
	name: string;
	played: number;
	won: number;
	lost: number;
	points: number;
	form: StandingFormResult[];
};

const PLAYERS: Player[] = [
	{
		name: "Lena Haugen",
		played: 64,
		won: 44,
		lost: 20,
		points: 1412,
		form: ["W", "W", "W", "W", "W"],
	},
	{
		name: "Omar Diallo",
		played: 71,
		won: 41,
		lost: 30,
		points: 1318,
		form: ["W", "L", "W", "W", "L"],
	},
	{
		name: "Priya Raman",
		played: 58,
		won: 31,
		lost: 27,
		points: 1247,
		form: ["L", "W", "W", "L", "W"],
	},
	{
		name: "Jonas Becker",
		played: 66,
		won: 30,
		lost: 36,
		points: 1183,
		form: ["W", "L", "L", "W", "L"],
	},
	{
		name: "Sofia Moreno",
		played: 49,
		won: 19,
		lost: 30,
		points: 1096,
		form: ["L", "L", "L", "L", "L"],
	},
];

const TEAMS = [
	{ players: ["Lena Haugen", "Priya Raman"], rating: 1288 },
	{ players: ["Omar Diallo", "Sofia Moreno"], rating: 1174 },
];

const PROGRESSION = [
	{ match: 1, lena: 1000, omar: 1000, priya: 1000, jonas: 1000 },
	{ match: 2, lena: 1032, omar: 1018, priya: 984, jonas: 1006 },
	{ match: 3, lena: 1061, omar: 1049, priya: 1011, jonas: 1022 },
	{ match: 4, lena: 1088, omar: 1102, priya: 1043, jonas: 1047 },
	{ match: 5, lena: 1140, omar: 1131, priya: 1092, jonas: 1081 },
	{ match: 6, lena: 1196, omar: 1170, priya: 1124, jonas: 1112 },
	{ match: 7, lena: 1231, omar: 1226, priya: 1158, jonas: 1149 },
	{ match: 8, lena: 1290, omar: 1251, priya: 1203, jonas: 1162 },
	{ match: 9, lena: 1347, omar: 1288, priya: 1219, jonas: 1176 },
	{ match: 10, lena: 1412, omar: 1318, priya: 1247, jonas: 1183 },
];

const progressionConfig = {
	lena: { label: "Lena", color: "var(--chart-1)" },
	omar: { label: "Omar", color: "var(--chart-2)" },
	priya: { label: "Priya", color: "var(--chart-3)" },
	jonas: { label: "Jonas", color: "var(--chart-4)" },
} satisfies ChartConfig;

const SIDEBAR_ITEMS = [
	{ label: "Active Season", icon: Home01Icon, active: true },
	{ label: "Seasons", icon: Calendar03Icon },
	{ label: "Players", icon: UserIcon },
	{ label: "Teams", icon: UserGroupIcon },
	{ label: "Achievements", icon: Medal01Icon },
];

const ACHIEVEMENTS = [
	{ name: "10 Win Streak", detail: "Win 10 matches in a row", glow: glowColors.amber },
	{ name: "5 Clean Sheets", detail: "5 straight matches without conceding", glow: glowColors.blue },
	{ name: "Season Winner", detail: "Finish a season at the top", glow: glowColors.purple },
];

const PLATFORMS = [
	{
		title: "Web",
		description: "The full dashboard for leagues, seasons, players and settings.",
		icon: ComputerIcon,
		glow: "card-glow-blue",
		iconClassName: "text-blue-400",
	},
	{
		title: "iOS",
		description: "Log matches and follow live sessions from your phone, with push notifications.",
		icon: SmartPhone01Icon,
		glow: "card-glow-emerald",
		iconClassName: "text-emerald-500",
	},
	{
		title: "AI assistants",
		description: "Connect Claude or any MCP client and log results in plain language.",
		icon: AiChat02Icon,
		glow: "card-glow-purple",
		iconClassName: "text-purple-400",
	},
];

const firstName = (name: string) => name.split(" ")[0];

const IconCard = ({
	title,
	description,
	icon,
	glow,
	iconClassName,
	children,
	className,
}: {
	title: string;
	description?: string;
	icon: IconSvgElement;
	glow?: string;
	iconClassName?: string;
	children: ReactNode;
	className?: string;
}) => (
	<Card className={cn("relative h-full", className)}>
		{glow && <div className={cn("absolute inset-0", glow)} />}
		<CardHeader className="relative">
			<div className="flex items-center justify-between">
				<CardTitle>{title}</CardTitle>
				<HugeiconsIcon icon={icon} className={cn("size-4 text-muted-foreground", iconClassName)} />
			</div>
			{description && <CardDescription>{description}</CardDescription>}
		</CardHeader>
		<CardContent className="relative mt-auto">{children}</CardContent>
	</Card>
);

const PlayerStatCard = ({
	title,
	icon,
	glowColor,
	iconColor,
	player,
}: {
	title: string;
	icon: IconSvgElement;
	glowColor: string;
	iconColor: string;
	player: Player;
}) => (
	<DashboardCard title={title} icon={icon} glowColor={glowColor} iconColor={iconColor}>
		<div className="flex min-w-0 items-center gap-3">
			<AvatarWithFallback src={landingAvatar(player.name)} name={player.name} size="md" />
			<div className="flex min-w-0 flex-1 flex-col">
				<span className="truncate text-sm font-medium">{player.name}</span>
				<span className="text-muted-foreground text-xs">{player.points} points</span>
			</div>
			<FormDots form={player.form} />
		</div>
	</DashboardCard>
);

const LatestMatchSide = ({
	name,
	score,
	winner = false,
}: {
	name: string;
	score: number;
	winner?: boolean;
}) => (
	<div className="flex min-w-0 items-center gap-3">
		<div className="flex min-w-0 flex-1 items-center gap-2">
			<AvatarWithFallback src={landingAvatar(name)} name={name} size="sm" />
			<span
				className={cn(
					"truncate text-xs",
					winner ? "text-foreground font-semibold" : "text-muted-foreground"
				)}
			>
				{name}
			</span>
		</div>
		<div
			className={cn(
				"bg-primary/10 flex size-7 shrink-0 items-center justify-center rounded-md border text-sm",
				winner ? "text-foreground font-bold" : "text-muted-foreground font-medium"
			)}
		>
			{score}
		</div>
	</div>
);

const ProgressionChart = ({ className }: { className?: string }) => (
	<ChartContainer config={progressionConfig} className={cn("aspect-auto w-full", className)}>
		<LineChart data={PROGRESSION} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
			<CartesianGrid vertical={false} strokeDasharray="3 3" />
			<XAxis dataKey="match" hide />
			<YAxis hide domain={["dataMin - 20", "dataMax + 20"]} />
			{Object.keys(progressionConfig).map((key) => (
				<Line
					key={key}
					dataKey={key}
					type="monotone"
					stroke={`var(--color-${key})`}
					strokeWidth={2}
					dot={false}
					isAnimationActive={false}
				/>
			))}
		</LineChart>
	</ChartContainer>
);

const StandingsTable = () => (
	<Table>
		<TableHeader>
			<TableRow>
				<TableHead>Name</TableHead>
				<TableHead className="text-center">MP</TableHead>
				<TableHead className="hidden text-center sm:table-cell">W</TableHead>
				<TableHead className="hidden text-center sm:table-cell">L</TableHead>
				<TableHead className="text-center">Pts</TableHead>
				<TableHead className="text-center">Last 5</TableHead>
			</TableRow>
		</TableHeader>
		<TableBody>
			{PLAYERS.map((player) => (
				<TableRow key={player.name}>
					<TableCell>
						<div className="flex items-center gap-2">
							<StreakAvatar
								src={landingAvatar(player.name)}
								name={player.name}
								streak={calculateStreak(player.form)}
								size={28}
							/>
							<span className="truncate">{player.name}</span>
						</div>
					</TableCell>
					<TableCell className="text-center tabular-nums">{player.played}</TableCell>
					<TableCell className="hidden text-center tabular-nums sm:table-cell">
						{player.won}
					</TableCell>
					<TableCell className="hidden text-center tabular-nums sm:table-cell">
						{player.lost}
					</TableCell>
					<TableCell className="text-center font-bold tabular-nums">{player.points}</TableCell>
					<TableCell>
						<FormDots form={player.form} />
					</TableCell>
				</TableRow>
			))}
		</TableBody>
	</Table>
);

const AppPreview = () => {
	const leader = PLAYERS[0];
	const struggler = PLAYERS[PLAYERS.length - 1];

	return (
		<div className="bg-background ring-foreground/10 relative ring-1 shadow-[0_30px_80px_-40px_color-mix(in_oklab,var(--glow-blue-solid)_35%,transparent)]">
			<div className="flex items-center gap-1.5 border-b px-3 py-2">
				<span className="bg-foreground/15 size-2 rounded-full" />
				<span className="bg-foreground/15 size-2 rounded-full" />
				<span className="bg-foreground/15 size-2 rounded-full" />
				<span className="text-muted-foreground mx-auto truncate text-[0.65rem]">
					scorebrawl.com/leagues/office-foosball
				</span>
			</div>
			<div className="flex text-left">
				<aside className="bg-sidebar hidden w-52 shrink-0 border-r p-2 md:block">
					<div className="flex items-center gap-2 p-2">
						<AvatarWithFallback
							src="/landing/leagues/office-foosball.svg"
							name="Office Foosball"
							size="sm"
						/>
						<span className="truncate text-xs font-medium">Office Foosball</span>
					</div>
					<nav className="mt-3 space-y-0.5">
						{SIDEBAR_ITEMS.map((item) => (
							<div
								key={item.label}
								className={cn(
									"text-muted-foreground flex items-center gap-2 px-2 py-1.5 text-xs",
									item.active && "bg-sidebar-accent text-sidebar-accent-foreground"
								)}
							>
								<HugeiconsIcon icon={item.icon} className="size-4" />
								{item.label}
							</div>
						))}
					</nav>
				</aside>
				<div className="min-w-0 flex-1 space-y-3 p-3 sm:p-4">
					<div className="flex items-center justify-between">
						<div className="text-muted-foreground text-xs">
							Seasons <span className="mx-1">›</span>
							<span className="text-foreground">Autumn 2026</span>
						</div>
						<div className="flex items-center gap-2">
							<Button size="sm" variant="outline" className="gap-1.5">
								<HugeiconsIcon icon={PlayIcon} className="size-3.5" />
								Start Session
							</Button>
							<GlowButton
								icon={Add01Icon}
								glowColor={glowColors.blue}
								size="sm"
								className="gap-1.5"
							>
								Match
							</GlowButton>
						</div>
					</div>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<PlayerStatCard
							title="On Fire"
							icon={FireIcon}
							glowColor="card-glow-red"
							iconColor="text-red-600"
							player={leader}
						/>
						<PlayerStatCard
							title="Struggling"
							icon={SnowIcon}
							glowColor="card-glow-blue"
							iconColor="text-blue-600"
							player={struggler}
						/>
						<div className="hidden lg:block">
							<DashboardCard
								title="General Info"
								icon={BarChartIcon}
								glowColor="card-glow-emerald"
								iconColor="text-emerald-600"
							>
								<div className="grid grid-cols-3 gap-2 text-center">
									{[
										{ value: 308, label: "Matches" },
										{ value: 12, label: "Players" },
										{ value: 18, label: "Teams" },
									].map(({ value, label }) => (
										<div key={label}>
											<div className="text-lg font-bold">{value}</div>
											<div className="text-muted-foreground text-xs">{label}</div>
										</div>
									))}
								</div>
							</DashboardCard>
						</div>
						<div className="hidden lg:block">
							<DashboardCard
								title="Latest Match"
								icon={Award01Icon}
								glowColor="card-glow-amber"
								iconColor="text-amber-600"
							>
								<div className="min-w-0 space-y-2">
									<LatestMatchSide name="Lena Haugen" score={10} winner />
									<LatestMatchSide name="Omar Diallo" score={7} />
								</div>
							</DashboardCard>
						</div>
					</div>
					<div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.25fr_1fr]">
						<Card size="sm">
							<CardHeader>
								<CardTitle>Standings</CardTitle>
							</CardHeader>
							<CardContent>
								<StandingsTable />
							</CardContent>
						</Card>
						<Card size="sm" className="hidden lg:flex">
							<CardHeader>
								<CardTitle>Point Progression</CardTitle>
							</CardHeader>
							<CardContent className="flex-1">
								<ProgressionChart className="h-56" />
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
};

const SectionHeading = ({
	eyebrow,
	title,
	body,
}: {
	eyebrow: string;
	title: string;
	body: string;
}) => (
	<div className="mx-auto max-w-2xl text-center">
		<Badge variant="outline">{eyebrow}</Badge>
		<h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-4xl">{title}</h2>
		<p className="text-muted-foreground mt-3 text-sm leading-relaxed">{body}</p>
	</div>
);

const Features = () => {
	const lena = PLAYERS[0];
	const sofia = PLAYERS[PLAYERS.length - 1];

	return (
		<section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
			<SectionHeading
				eyebrow="Features"
				title="Everything a rivalry needs"
				body="Leagues, seasons and rankings that update the moment a match is logged."
			/>
			<div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				<IconCard
					title="Scoring systems"
					description="Pick how each season is scored. ELO rewards upsets, 3-1-0 rewards consistency."
					icon={ChampionIcon}
					glow="card-glow-blue"
					iconClassName="text-blue-400"
				>
					<div inert className="flex flex-wrap gap-2">
						<GlowButton size="sm" glowColor={glowColors.blue}>
							ELO
						</GlowButton>
						<GlowButton size="sm" glowColor={glowColors.emerald}>
							3-1-0
						</GlowButton>
						<GlowButton size="sm" glowColor={glowColors.amber}>
							1 v N
						</GlowButton>
						<GlowButton size="sm" glowColor={glowColors.purple}>
							Solo v Team
						</GlowButton>
					</div>
				</IconCard>
				<IconCard
					title="Streaks"
					description="Five wins in a row sets your avatar on fire. Five losses freezes it."
					icon={FireIcon}
					glow="card-glow-amber"
					iconClassName="text-amber-500"
				>
					<div className="flex items-center justify-around py-2">
						{[
							{ player: lena, label: "On fire" },
							{ player: sofia, label: "Frozen" },
						].map(({ player, label }) => (
							<div key={label} className="flex flex-col items-center gap-2">
								<StreakAvatar
									src={landingAvatar(player.name)}
									name={player.name}
									streak={calculateStreak(player.form)}
									size={56}
								/>
								<span className="text-muted-foreground">{label}</span>
							</div>
						))}
					</div>
				</IconCard>
				<IconCard
					title="Achievements"
					description="Win streaks, clean sheets, comebacks and season titles stay on your profile."
					icon={Medal01Icon}
					glow="card-glow-purple"
					iconClassName="text-purple-400"
				>
					<div className="space-y-2">
						{ACHIEVEMENTS.map((achievement) => (
							<div
								key={achievement.name}
								className="ring-foreground/10 flex items-center gap-3 p-2 ring-1"
							>
								<span
									className="flex size-7 shrink-0 items-center justify-center border"
									style={{
										backgroundColor: achievement.glow.background,
										color: achievement.glow.text,
										borderColor: achievement.glow.border,
									}}
								>
									<HugeiconsIcon icon={Medal01Icon} className="size-4" />
								</span>
								<div className="min-w-0">
									<div className="font-medium">{achievement.name}</div>
									<div className="text-muted-foreground truncate">{achievement.detail}</div>
								</div>
							</div>
						))}
					</div>
				</IconCard>
				<IconCard
					className="lg:col-span-2"
					title="Point progression"
					description="Follow every player's rating through the season, match by match."
					icon={ChartLineData02Icon}
					glow="card-glow-emerald"
					iconClassName="text-emerald-500"
				>
					<ProgressionChart className="h-44" />
				</IconCard>
				<IconCard
					title="Teams"
					description="Play 2v2 and teams form automatically, with their own standings."
					icon={UserGroupIcon}
					glow="card-glow-pink"
					iconClassName="text-pink-500"
				>
					<div className="space-y-2">
						{TEAMS.map((team) => (
							<div
								key={team.players.join()}
								className="ring-foreground/10 flex items-center gap-3 p-2 ring-1"
							>
								<div className="flex gap-1">
									{team.players.map((name) => (
										<AvatarWithFallback
											key={name}
											src={landingAvatar(name)}
											name={name}
											size="sm"
										/>
									))}
								</div>
								<span className="flex-1 truncate">{team.players.map(firstName).join(" & ")}</span>
								<span className="font-bold tabular-nums">{team.rating}</span>
							</div>
						))}
					</div>
				</IconCard>
			</div>
		</section>
	);
};

const LiveSessions = () => (
	<section id="live" className="scroll-mt-20 border-y">
		<div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
			<SectionHeading
				eyebrow="Live sessions"
				title="Game night, in real time"
				body="Start a session and keep score point by point. Winner stays on, the queue rotates itself, and every device in the room sees the same scoreboard."
			/>
			<div className="mt-12">
				<SessionPreview />
			</div>
		</div>
	</section>
);

const Platforms = () => (
	<section id="everywhere" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
		<SectionHeading
			eyebrow="Everywhere"
			title="Keep score wherever you play"
			body="One league, synced across every device. Automate the rest with league API keys."
		/>
		<div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
			{PLATFORMS.map((platform) => (
				<Card key={platform.title} className="relative">
					<div className={cn("absolute inset-0", platform.glow)} />
					<CardHeader className="relative">
						<HugeiconsIcon
							icon={platform.icon}
							className={cn("mb-4 size-6", platform.iconClassName)}
						/>
						<CardTitle>{platform.title}</CardTitle>
						<CardDescription>{platform.description}</CardDescription>
					</CardHeader>
				</Card>
			))}
		</div>
		<Card className="mt-4">
			<CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="text-sm font-medium">Connect your AI assistant</div>
					<div className="text-muted-foreground">
						Add the remote MCP server in Claude or Cursor and sign in — your assistant can read
						standings and log matches.
					</div>
				</div>
				<code className="bg-muted px-3 py-2 text-xs">https://api.scorebrawl.com/mcp</code>
			</CardContent>
		</Card>
	</section>
);

const HeroBackground = () => (
	<div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
		<div
			className="absolute inset-0 opacity-60"
			style={{
				backgroundImage:
					"linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
				backgroundSize: "56px 56px",
				maskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 75%)",
			}}
		/>
		<div className="absolute -top-40 left-1/2 h-[36rem] w-[64rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--glow-blue-solid),transparent)] opacity-10 blur-3xl" />
		<div className="absolute top-40 -right-40 size-80 rounded-full bg-[radial-gradient(closest-side,var(--glow-amber-solid),transparent)] opacity-10 blur-3xl" />
	</div>
);

const Landing = () => {
	const { data: session, isPending } = useSession();
	const signedIn = Boolean(session);
	const primaryTarget = signedIn ? "/" : "/auth/sign-in";
	const primaryLabel = signedIn ? "Open your leagues" : "Start a league";
	const navigate = useNavigate();
	const goPrimary = () => navigate({ to: primaryTarget });

	return (
		<div className="bg-background text-foreground min-h-screen">
			<header className="bg-background/70 sticky top-0 z-50 border-b backdrop-blur-xl">
				<div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
					<Link to="/home" className="flex items-center gap-2">
						<BrandMark className="size-9" />
						<span className="text-sm font-bold">Scorebrawl</span>
					</Link>
					<nav className="text-muted-foreground hidden items-center gap-6 text-xs md:flex">
						<a href="#features" className="hover:text-foreground transition-colors">
							Features
						</a>
						<a href="#live" className="hover:text-foreground transition-colors">
							Live sessions
						</a>
						<a href="#everywhere" className="hover:text-foreground transition-colors">
							Everywhere
						</a>
					</nav>
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="icon"
							aria-label="Scorebrawl on GitHub"
							nativeButton={false}
							render={<a href={GITHUB_URL} target="_blank" rel="noreferrer" />}
						>
							<HugeiconsIcon icon={GithubIcon} />
						</Button>
						{!isPending && (
							<GlowButton glowColor={glowColors.blue} size="sm" onClick={goPrimary}>
								{signedIn ? "Dashboard" : "Sign in"}
							</GlowButton>
						)}
					</div>
				</div>
			</header>

			<main>
				<section className="relative isolate overflow-hidden">
					<HeroBackground />
					<div className="mx-auto max-w-6xl px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
						<Badge variant="outline" className="bg-background/60">
							Leagues · Seasons · ELO · Live sessions
						</Badge>
						<h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
							Settle every rivalry.
							<br />
							<span className="text-primary">Keep the score.</span>
						</h1>
						<p className="text-muted-foreground mx-auto mt-6 max-w-xl text-sm leading-relaxed">
							Scorebrawl turns foosball, darts, pool and any game you play together into leagues
							with seasons, rankings, streaks and achievements.
						</p>
						<div className="mt-8 flex flex-wrap justify-center gap-3">
							<GlowButton
								glowColor={glowColors.blue}
								size="lg"
								className="gap-1.5"
								onClick={goPrimary}
							>
								{primaryLabel}
								<HugeiconsIcon icon={ArrowRight02Icon} className="size-4" />
							</GlowButton>
							<Button
								size="lg"
								variant="outline"
								nativeButton={false}
								render={<a href={GITHUB_URL} target="_blank" rel="noreferrer" />}
							>
								<HugeiconsIcon icon={GithubIcon} data-icon="inline-start" />
								View on GitHub
							</Button>
						</div>
					</div>
					<div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
						<div inert>
							<AppPreview />
						</div>
					</div>
				</section>

				<Features />
				<LiveSessions />
				<Platforms />

				<section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
					<Card className="relative py-12 text-center">
						<div className="card-glow-blue absolute inset-0" />
						<CardContent className="relative flex flex-col items-center gap-4">
							<BrandMark className="size-32" />
							<h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
								Your next match counts
							</h2>
							<p className="text-muted-foreground max-w-md text-sm">
								Create a league, invite your rivals and log the first result in under a minute.
							</p>
							<GlowButton
								glowColor={glowColors.blue}
								size="lg"
								className="mt-2 gap-1.5"
								onClick={goPrimary}
							>
								{primaryLabel}
								<HugeiconsIcon icon={ArrowRight02Icon} className="size-4" />
							</GlowButton>
						</CardContent>
					</Card>
				</section>
			</main>

			<footer className="border-t">
				<div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-xs sm:flex-row sm:px-6">
					<div className="flex items-center gap-2">
						<BrandMark className="size-7" />
						<span>© {new Date().getFullYear()} Scorebrawl</span>
					</div>
					<a
						href={GITHUB_URL}
						target="_blank"
						rel="noreferrer"
						className="hover:text-foreground transition-colors"
					>
						GitHub
					</a>
				</div>
			</footer>
		</div>
	);
};

export default Landing;
