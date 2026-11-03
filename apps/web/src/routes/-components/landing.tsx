import {
	Add01Icon,
	AiChat02Icon,
	ArrowRight02Icon,
	ArrowUpRight03Icon,
	Award01Icon,
	BarChartIcon,
	Calendar03Icon,
	Cancel01Icon,
	ChampionIcon,
	ChartLineData02Icon,
	ComputerIcon,
	FireIcon,
	GithubIcon,
	Home01Icon,
	Medal01Icon,
	Menu01Icon,
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
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { CartesianGrid, Line, LineChart } from "recharts";
import { BrandMark } from "@/components/brand-mark";
import { StreakAvatar } from "@/components/streak-avatar";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { FormDots } from "@/components/ui/form-dots";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { useSession } from "@/hooks/useSession";
import { DashboardCard } from "@/routes/_authenticated/_sidebar/leagues/$slug/seasons/-components/season/dashboard-card";
import { LandingCta } from "./landing-cta";
import { useActiveSection, usePassedElement } from "./landing-hooks";
import { landingAvatar, SessionPreview } from "./landing-session-preview";
import { cn } from "@/lib/utils";

const GITHUB_URL = "https://github.com/thor-coding-cowboys/scorebrawl";
const LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE`;
const DEVELOPER_DOCS_URL = `${GITHUB_URL}/tree/main/docs/features`;
const MCP_URL = "https://api.scorebrawl.com/mcp";

const SECTIONS = [
	{ id: "live", label: "Live" },
	{ id: "features", label: "Features" },
	{ id: "everywhere", label: "Everywhere" },
	{ id: "developers", label: "Developers" },
] as const;

const SECTION_IDS = SECTIONS.map((section) => section.id);

const LIVE_MODES = ["Winner stays", "Manual lineup", "Coin toss"];

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

// Four glow hues (blue / red / emerald / amber), stepped for contrast on each theme.
const progressionConfig = {
	lena: {
		label: "Lena Haugen",
		theme: { light: "var(--blue-600)", dark: "var(--blue-300)" },
	},
	omar: {
		label: "Omar Diallo",
		theme: { light: "var(--red-600)", dark: "var(--red-300)" },
	},
	priya: {
		label: "Priya Raman",
		theme: { light: "var(--emerald-600)", dark: "var(--emerald-300)" },
	},
	jonas: {
		label: "Jonas Becker",
		theme: { light: "var(--amber-700)", dark: "var(--amber-300)" },
	},
} satisfies ChartConfig;

const PROGRESSION_SERIES = [
	{
		key: "lena",
		label: progressionConfig.lena.label,
		swatch: "bg-[var(--blue-600)] dark:bg-[var(--blue-300)]",
	},
	{
		key: "omar",
		label: progressionConfig.omar.label,
		swatch: "bg-[var(--red-600)] dark:bg-[var(--red-300)]",
	},
	{
		key: "priya",
		label: progressionConfig.priya.label,
		swatch: "bg-[var(--emerald-600)] dark:bg-[var(--emerald-300)]",
	},
	{
		key: "jonas",
		label: progressionConfig.jonas.label,
		swatch: "bg-[var(--amber-700)] dark:bg-[var(--amber-300)]",
	},
] as const;

const SIDEBAR_ITEMS = [
	{ label: "Active Season", icon: Home01Icon, active: true },
	{ label: "Seasons", icon: Calendar03Icon },
	{ label: "Players", icon: UserIcon },
	{ label: "Teams", icon: UserGroupIcon },
	{ label: "Achievements", icon: Medal01Icon },
];

const ACHIEVEMENTS = [
	{ name: "10 Win Streak", detail: "Win ten matches in a row", glow: glowColors.amber },
	{
		name: "5 Clean Sheets",
		detail: "Five straight without conceding",
		glow: glowColors.blue,
	},
	{ name: "Season Winner", detail: "Finish a season on top", glow: glowColors.purple },
];

const SCORING_MODES = [
	{ label: "ELO rating", tone: glowColors.blue },
	{ label: "Points 3-1-0", tone: glowColors.emerald },
	{ label: "1-v-N ELO", tone: glowColors.amber },
];

const PLATFORMS = [
	{
		index: "01",
		title: "Web",
		icon: ComputerIcon,
		description: "Run the league, seasons, players and scoring from one dashboard.",
	},
	{
		index: "02",
		title: "iOS",
		icon: SmartPhone01Icon,
		description: "Follow live sessions from your phone and keep the queue moving while you play.",
	},
	{
		index: "03",
		title: "AI assistants",
		icon: AiChat02Icon,
		description: "Connect Claude or any MCP client and log results in plain language.",
	},
];

const firstName = (name: string) => name.split(" ")[0];

const ProgressionChart = ({ className }: { className?: string }) => (
	<ChartContainer config={progressionConfig} className={cn("aspect-auto w-full", className)}>
		<LineChart data={PROGRESSION} margin={{ left: 2, right: 6, top: 8, bottom: 0 }}>
			<CartesianGrid vertical={false} strokeDasharray="3 3" />
			{PROGRESSION_SERIES.map(({ key }) => (
				<Line
					key={key}
					dataKey={key}
					type="monotone"
					stroke={`var(--color-${key})`}
					strokeWidth={2.5}
					strokeLinecap="round"
					dot={false}
					isAnimationActive={false}
				/>
			))}
		</LineChart>
	</ChartContainer>
);

const ProgressionLegend = ({ className }: { className?: string }) => (
	<ul className={cn("flex flex-wrap gap-x-4 gap-y-2", className)}>
		{PROGRESSION_SERIES.map(({ key, label, swatch }) => (
			<li
				key={key}
				className="text-muted-foreground flex items-center gap-1.5 font-mono text-[0.6rem] tracking-[0.08em] uppercase"
			>
				<span aria-hidden className={cn("size-2 shrink-0", swatch)} />
				{label}
			</li>
		))}
	</ul>
);

const PlayerStatCard = ({
	title,
	icon,
	iconColor,
	player,
}: {
	title: string;
	icon: IconSvgElement;
	iconColor: string;
	player: Player;
}) => (
	<DashboardCard title={title} icon={icon} iconColor={iconColor}>
		<div className="flex min-w-0 items-start gap-2.5">
			<AvatarWithFallback src={landingAvatar(player.name)} name={player.name} size="md" />
			<div className="min-w-0 flex-1">
				<p className="text-[0.8rem] leading-tight font-medium break-words">{player.name}</p>
				<p className="text-muted-foreground mt-0.5 font-mono text-[0.65rem] whitespace-nowrap">
					{player.points} points
				</p>
				<div className="mt-1.5">
					<FormDots form={player.form} />
				</div>
			</div>
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
	<div className="flex min-w-0 items-center gap-2.5">
		<AvatarWithFallback src={landingAvatar(name)} name={name} size="sm" />
		<span
			className={cn(
				"min-w-0 text-xs leading-tight break-words",
				winner ? "text-foreground font-semibold" : "text-muted-foreground"
			)}
		>
			{name}
		</span>
		<div
			className={cn(
				"bg-primary/10 ml-auto flex size-7 shrink-0 items-center justify-center border font-mono text-sm tabular-nums",
				winner ? "text-foreground font-bold" : "text-muted-foreground font-medium"
			)}
		>
			{score}
		</div>
	</div>
);

const Standings = () => (
	<div className="min-w-0">
		<div
			aria-hidden
			className="text-muted-foreground hidden grid-cols-[1.25rem_minmax(0,1fr)_2rem_2rem_2rem_3rem_5rem] items-center gap-x-2 border-b pb-1.5 font-mono text-[0.55rem] tracking-[0.12em] uppercase sm:grid"
		>
			<span>#</span>
			<span>Player</span>
			<span className="text-right">MP</span>
			<span className="text-right">W</span>
			<span className="text-right">L</span>
			<span className="text-right">Pts</span>
			<span className="text-right">Last 5</span>
		</div>
		<ul className="divide-border/70 divide-y">
			{PLAYERS.map((player, index) => (
				<li
					key={player.name}
					className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-2 py-1.5 sm:grid-cols-[1.25rem_minmax(0,1fr)_2rem_2rem_2rem_3rem_5rem]"
				>
					<span className="text-muted-foreground font-mono text-[0.65rem] tabular-nums">
						{String(index + 1).padStart(2, "0")}
					</span>
					<div className="flex min-w-0 items-center gap-2">
						<StreakAvatar
							src={landingAvatar(player.name)}
							name={player.name}
							streak={calculateStreak(player.form)}
							size={26}
						/>
						<div className="min-w-0">
							<p className="text-[0.7rem] leading-tight font-medium break-words">{player.name}</p>
							<p className="text-muted-foreground mt-0.5 font-mono text-[0.55rem] tracking-[0.08em] uppercase sm:hidden">
								{player.played} MP / {player.won}W {player.lost}L
							</p>
							<div className="mt-1 sm:hidden">
								<FormDots form={player.form} />
							</div>
						</div>
					</div>
					<span className="hidden text-right font-mono text-[0.65rem] tabular-nums text-muted-foreground sm:block">
						{player.played}
					</span>
					<span className="hidden text-right font-mono text-[0.65rem] tabular-nums text-muted-foreground sm:block">
						{player.won}
					</span>
					<span className="hidden text-right font-mono text-[0.65rem] tabular-nums text-muted-foreground sm:block">
						{player.lost}
					</span>
					<span className="text-right font-mono text-[0.7rem] font-bold whitespace-nowrap tabular-nums">
						{player.points}
						<span className="text-muted-foreground text-[0.55rem] font-normal sm:hidden"> pts</span>
					</span>
					<div className="hidden justify-end sm:flex">
						<FormDots form={player.form} />
					</div>
				</li>
			))}
		</ul>
	</div>
);

const AppPreview = () => {
	const leader = PLAYERS[0];
	const struggler = PLAYERS[PLAYERS.length - 1];

	return (
		<div className="bg-background ring-foreground/10 relative ring-1 shadow-[0_40px_120px_-50px_color-mix(in_oklab,var(--glow-blue-solid)_45%,transparent)]">
			<div className="flex items-center gap-3 border-b px-3 py-2">
				<span className="text-muted-foreground font-mono text-[0.55rem] tracking-[0.2em] uppercase">
					League dashboard
				</span>
				<span className="text-muted-foreground/70 ml-auto hidden truncate font-mono text-[0.55rem] sm:block">
					scorebrawl.com/leagues/office-foosball
				</span>
			</div>
			<div className="flex text-left">
				<aside className="bg-sidebar hidden w-48 shrink-0 border-r p-2 md:block">
					<div className="flex items-center gap-2 p-2">
						<AvatarWithFallback
							src="/landing/leagues/office-foosball.svg"
							name="Office Foosball"
							size="sm"
						/>
						<span className="truncate text-xs font-medium">Office Foosball</span>
					</div>
					<nav aria-hidden className="mt-3 space-y-0.5">
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
					<div className="flex items-center justify-between gap-3">
						<div className="text-muted-foreground flex min-w-0 items-center gap-1 font-mono text-[0.6rem]">
							<span>Seasons</span>
							<span aria-hidden>/</span>
							<span className="text-foreground truncate">Autumn 2026</span>
						</div>
						<div className="flex shrink-0 items-center gap-2">
							<Button size="sm" variant="outline" className="hidden gap-1.5 sm:inline-flex">
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
							iconColor="text-red-600 dark:text-red-400"
							player={leader}
						/>
						<PlayerStatCard
							title="Struggling"
							icon={SnowIcon}
							iconColor="text-blue-600 dark:text-blue-400"
							player={struggler}
						/>
						<div className="hidden lg:block">
							<DashboardCard
								title="General Info"
								icon={BarChartIcon}
								iconColor="text-emerald-600 dark:text-emerald-400"
							>
								<div className="grid grid-cols-3 gap-2 text-center">
									{[
										{ value: 308, label: "Matches" },
										{ value: 12, label: "Players" },
										{ value: 18, label: "Teams" },
									].map(({ value, label }) => (
										<div key={label}>
											<div className="font-mono text-lg font-bold tabular-nums">{value}</div>
											<div className="text-muted-foreground text-[0.65rem]">{label}</div>
										</div>
									))}
								</div>
							</DashboardCard>
						</div>
						<div className="hidden lg:block">
							<DashboardCard
								title="Latest Match"
								icon={Award01Icon}
								iconColor="text-amber-600 dark:text-amber-400"
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
								<Standings />
							</CardContent>
						</Card>
						<Card size="sm" className="hidden lg:flex">
							<CardHeader>
								<CardTitle>Point Progression</CardTitle>
							</CardHeader>
							<CardContent className="flex-1">
								<ProgressionLegend className="mb-2" />
								<ProgressionChart className="h-40" />
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
};

const SectionIntro = ({
	eyebrow,
	title,
	body,
	className,
}: {
	eyebrow: string;
	title: string;
	body: string;
	className?: string;
}) => (
	<div className={cn("max-w-2xl", className)}>
		<div className="flex items-center gap-3">
			<span aria-hidden className="bg-primary h-px w-8" />
			<span className="text-muted-foreground font-mono text-[0.65rem] tracking-[0.3em] uppercase">
				{eyebrow}
			</span>
		</div>
		<h2 className="mt-4 font-mono text-3xl leading-[0.98] font-bold tracking-[-0.03em] text-balance uppercase sm:text-4xl lg:text-5xl">
			{title}
		</h2>
		<p className="text-muted-foreground mt-4 max-w-xl text-pretty text-sm leading-relaxed">
			{body}
		</p>
	</div>
);

const FeatureCard = ({
	index,
	title,
	icon,
	iconClassName,
	description,
	className,
	children,
}: {
	index: string;
	title: string;
	icon: IconSvgElement;
	iconClassName: string;
	description: string;
	className?: string;
	children: ReactNode;
}) => (
	<article className={cn("border-border bg-card/40 flex flex-col border p-5", className)}>
		<div className="flex items-start justify-between gap-4">
			<div className="flex items-center gap-3">
				<HugeiconsIcon icon={icon} className={cn("size-5 shrink-0", iconClassName)} />
				<h3 className="max-w-[20ch] font-mono text-sm leading-tight font-semibold tracking-[0.12em] uppercase">
					{title}
				</h3>
			</div>
			<span aria-hidden className="text-muted-foreground/70 font-mono text-[0.65rem] tabular-nums">
				{index}
			</span>
		</div>
		<p className="text-muted-foreground mt-3 text-pretty text-xs leading-relaxed">{description}</p>
		<div className="mt-5 flex flex-1 flex-col justify-end">{children}</div>
	</article>
);

const Features = () => {
	const lena = PLAYERS[0];
	const sofia = PLAYERS[PLAYERS.length - 1];

	return (
		<section id="features" className="scroll-mt-20 border-t">
			<div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
				<SectionIntro
					eyebrow="The system"
					title="Every rivalry needs rules"
					body="Leagues, seasons and rankings that update the moment a match is logged. Pick a scoring system, set the field, and let the table do the talking."
				/>
				<div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-6">
					<FeatureCard
						index="01"
						title="Scoring systems"
						icon={ChampionIcon}
						iconClassName="text-blue-600 dark:text-blue-400"
						description="Choose how each season is scored. ELO rewards upsets, 3-1-0 rewards consistency."
						className="md:col-span-3"
					>
						<ul className="flex flex-wrap gap-2">
							{SCORING_MODES.map((mode) => (
								<li
									key={mode.label}
									className="border px-2.5 py-1 font-mono text-[0.65rem] tracking-[0.1em] uppercase"
									style={{ borderColor: mode.tone.border, color: mode.tone.text }}
								>
									{mode.label}
								</li>
							))}
						</ul>
						<p className="text-muted-foreground mt-3 font-mono text-[0.6rem] tracking-[0.16em] uppercase">
							One per season
						</p>
					</FeatureCard>
					<FeatureCard
						index="02"
						title="Streaks"
						icon={FireIcon}
						iconClassName="text-amber-600 dark:text-amber-400"
						description="Five wins in a row sets your avatar on fire. Five losses freezes it."
						className="md:col-span-3"
					>
						<div className="flex items-center justify-around gap-4">
							{[
								{ player: lena, label: "On fire", detail: "5 straight wins" },
								{ player: sofia, label: "Frozen", detail: "5 straight losses" },
							].map(({ player, label, detail }) => (
								<div key={label} className="flex flex-col items-center gap-2 text-center">
									<StreakAvatar
										src={landingAvatar(player.name)}
										name={player.name}
										streak={calculateStreak(player.form)}
										size={52}
									/>
									<span className="font-mono text-[0.65rem] tracking-[0.12em] uppercase">
										{label}
									</span>
									<span className="text-muted-foreground text-[0.65rem]">{detail}</span>
								</div>
							))}
						</div>
					</FeatureCard>
					<FeatureCard
						index="03"
						title="Point progression"
						icon={ChartLineData02Icon}
						iconClassName="text-emerald-600 dark:text-emerald-400"
						description="Follow every player's rating through the season, match by match."
						className="md:col-span-4"
					>
						<ProgressionLegend className="mb-4" />
						<ProgressionChart className="h-44 sm:h-52" />
					</FeatureCard>
					<FeatureCard
						index="04"
						title="Teams"
						icon={UserGroupIcon}
						iconClassName="text-pink-600 dark:text-pink-300"
						description="Group players into 2v2 teams and track each pair's rating."
						className="md:col-span-2"
					>
						<div className="space-y-2">
							{TEAMS.map((team) => (
								<div
									key={team.players.join()}
									className="border-border/70 bg-background/40 flex items-center gap-2.5 border p-2"
								>
									<div className="flex -space-x-1.5">
										{team.players.map((name) => (
											<AvatarWithFallback
												key={name}
												src={landingAvatar(name)}
												name={name}
												size="sm"
											/>
										))}
									</div>
									<span className="min-w-0 flex-1 text-xs leading-tight text-pretty">
										{team.players.map(firstName).join(" & ")}
									</span>
									<span className="font-mono text-xs font-bold tabular-nums">{team.rating}</span>
								</div>
							))}
						</div>
					</FeatureCard>
					<FeatureCard
						index="05"
						title="Achievement shelf"
						icon={Medal01Icon}
						iconClassName="text-purple-600 dark:text-purple-400"
						description="Win streaks, clean sheets and season titles stay on your profile."
						className="md:col-span-6"
					>
						<div className="grid gap-2 sm:grid-cols-3">
							{ACHIEVEMENTS.map((achievement) => (
								<div
									key={achievement.name}
									className="border-border/70 bg-background/40 flex items-center gap-3 border p-2.5"
								>
									<span
										className="flex size-8 shrink-0 items-center justify-center border"
										style={{
											backgroundColor: achievement.glow.background,
											color: achievement.glow.text,
											borderColor: achievement.glow.border,
										}}
									>
										<HugeiconsIcon icon={Medal01Icon} className="size-4" />
									</span>
									<div className="min-w-0">
										<p className="text-xs font-medium">{achievement.name}</p>
										<p className="text-muted-foreground text-[0.7rem] text-pretty">
											{achievement.detail}
										</p>
									</div>
								</div>
							))}
						</div>
					</FeatureCard>
				</div>
			</div>
		</section>
	);
};

const LiveSessions = () => (
	<section id="live" className="bg-muted/20 scroll-mt-20 border-t">
		<div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
			<div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
				<SectionIntro
					eyebrow="Live sessions"
					title="The scoreboard nobody can argue with"
					body="Start a session and log points as they happen. Winner stays on, the queue rotates itself, and every device in the room sees the same score."
				/>
				<ul className="flex flex-wrap gap-2">
					{LIVE_MODES.map((mode) => (
						<li
							key={mode}
							className="border-border text-muted-foreground flex items-center gap-2 border px-2.5 py-1.5 font-mono text-[0.6rem] tracking-[0.12em] uppercase"
						>
							<span aria-hidden className="size-1.5 shrink-0 bg-emerald-500" />
							{mode}
						</li>
					))}
				</ul>
			</div>
			<div className="mt-10">
				<SessionPreview />
			</div>
		</div>
	</section>
);

const Everywhere = () => (
	<section id="everywhere" className="scroll-mt-20 border-t">
		<div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
			<SectionIntro
				eyebrow="Everywhere"
				title="One league. Every screen."
				body="The same table, the same session, the same bragging rights. Keep score at the table and check the damage from your phone."
			/>
			<div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
				{PLATFORMS.map((platform) => (
					<div key={platform.title} className="border-border bg-card/40 border p-5">
						<div className="flex items-start justify-between gap-3">
							<HugeiconsIcon icon={platform.icon} className="text-muted-foreground size-5" />
							<span aria-hidden className="text-muted-foreground/70 font-mono text-[0.65rem]">
								{platform.index}
							</span>
						</div>
						<h3 className="mt-6 font-mono text-sm font-semibold tracking-[0.14em] uppercase">
							{platform.title}
						</h3>
						<p className="text-muted-foreground mt-2 text-pretty text-xs leading-relaxed">
							{platform.description}
						</p>
					</div>
				))}
			</div>

			<div id="developers" className="border-border bg-card/40 mt-3 scroll-mt-24 border p-5">
				<div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
					<div className="max-w-xl">
						<p className="text-muted-foreground font-mono text-[0.6rem] tracking-[0.28em] uppercase">
							Developers
						</p>
						<p className="mt-2 text-pretty text-sm leading-relaxed">
							Point a client at the MCP server, or automate sessions and matches with the public
							REST API and league-scoped keys.
						</p>
					</div>
					<div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end">
						<code className="border-border bg-background max-w-full overflow-x-auto border px-3 py-2 font-mono text-[0.7rem] whitespace-nowrap">
							{MCP_URL}
						</code>
						<a
							href={DEVELOPER_DOCS_URL}
							target="_blank"
							rel="noreferrer"
							className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-1.5 font-mono text-[0.65rem] tracking-[0.12em] uppercase transition-colors hover:underline hover:underline-offset-4"
						>
							Developer docs
							<HugeiconsIcon icon={ArrowUpRight03Icon} className="size-3.5" />
						</a>
					</div>
				</div>
			</div>
		</div>
	</section>
);

const HeroBackground = () => (
	<div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
		<div
			className="absolute inset-0 opacity-60"
			style={{
				backgroundImage:
					"linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
				backgroundSize: "56px 56px",
				maskImage: "radial-gradient(ellipse 70% 55% at 50% 0%, black 30%, transparent 75%)",
			}}
		/>
		<div className="absolute top-[-20rem] left-1/2 h-[40rem] w-[70rem] -translate-x-1/2 bg-[radial-gradient(closest-side,var(--glow-blue-solid),transparent)] opacity-15 blur-3xl" />
	</div>
);

const Landing = () => {
	const { data: session } = useSession();
	const signedIn = Boolean(session);
	const primaryHref = signedIn ? "/" : "/auth/sign-in";
	const primaryLabel = signedIn ? "Open your leagues" : "Start your league";
	const headerLabel = signedIn ? "Dashboard" : "Sign in";
	const activeSection = useActiveSection(SECTION_IDS);
	const showStickyCta = usePassedElement("hero-end");
	const [mobileNavOpen, setMobileNavOpen] = useState(false);

	useEffect(() => {
		if (!mobileNavOpen) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setMobileNavOpen(false);
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [mobileNavOpen]);

	const goToSection = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
		const target = document.getElementById(id);
		if (!target) return;
		event.preventDefault();
		target.scrollIntoView({ behavior: "smooth", block: "start" });
		window.history.replaceState(null, "", `#${id}`);
		setMobileNavOpen(false);
	};

	return (
		<div className="bg-background text-foreground min-h-screen pb-24 sm:pb-0">
			<link rel="canonical" href="https://scorebrawl.com/" />
			<header className="bg-background/80 sticky top-0 z-50 border-b backdrop-blur-xl">
				<div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
					<Link
						to="/"
						aria-label="Scorebrawl"
						className="flex min-h-11 min-w-11 items-center gap-2"
					>
						<BrandMark className="size-8" />
						<span
							aria-hidden
							className="hidden font-mono text-sm font-bold tracking-[0.18em] uppercase sm:inline"
						>
							Scorebrawl
						</span>
					</Link>
					<nav aria-label="Sections" className="hidden items-center gap-5 md:flex">
						{SECTIONS.map((section) => {
							const active = activeSection === section.id;
							return (
								<a
									key={section.id}
									href={`#${section.id}`}
									aria-current={active ? "location" : undefined}
									onClick={(event) => goToSection(event, section.id)}
									className={cn(
										"inline-flex h-11 items-center border-b-2 px-1 font-mono text-[0.65rem] tracking-[0.2em] uppercase transition-colors",
										active
											? "border-primary text-foreground"
											: "text-muted-foreground hover:text-foreground border-transparent"
									)}
								>
									{section.label}
								</a>
							);
						})}
					</nav>
					<div className="flex items-center gap-1.5 sm:gap-2">
						<div className="flex size-11 items-center justify-center [&_button]:size-11!">
							<ThemeSwitcher />
						</div>
						<a
							href={GITHUB_URL}
							target="_blank"
							rel="noreferrer"
							aria-label="Scorebrawl on GitHub"
							className="text-muted-foreground hover:text-foreground hidden size-11 items-center justify-center transition-colors sm:inline-flex"
						>
							<HugeiconsIcon icon={GithubIcon} className="size-4" />
						</a>
						<LandingCta href={primaryHref} size="sm" className="px-3 sm:px-4">
							{headerLabel}
						</LandingCta>
						<button
							type="button"
							onClick={() => setMobileNavOpen((open) => !open)}
							aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
							aria-expanded={mobileNavOpen}
							aria-controls="landing-mobile-nav"
							className="border-border text-muted-foreground hover:text-foreground inline-flex size-11 items-center justify-center border transition-colors md:hidden"
						>
							<HugeiconsIcon icon={mobileNavOpen ? Cancel01Icon : Menu01Icon} className="size-5" />
						</button>
					</div>
				</div>
				<nav
					id="landing-mobile-nav"
					aria-label="Sections"
					hidden={!mobileNavOpen}
					className="bg-background border-t md:hidden"
				>
					<ul className="mx-auto max-w-6xl px-4 py-1">
						{SECTIONS.map((section) => (
							<li key={section.id}>
								<a
									href={`#${section.id}`}
									onClick={(event) => goToSection(event, section.id)}
									className="border-border/60 text-muted-foreground hover:text-foreground flex min-h-12 items-center justify-between border-b font-mono text-xs tracking-[0.2em] uppercase"
								>
									{section.label}
									<HugeiconsIcon icon={ArrowRight02Icon} className="size-4" />
								</a>
							</li>
						))}
					</ul>
				</nav>
			</header>

			<main>
				<section className="relative isolate overflow-hidden">
					<HeroBackground />
					<div className="mx-auto max-w-6xl px-4 pt-14 pb-16 text-center sm:px-6 sm:pt-20">
						<span className="border-border bg-background/60 inline-flex items-center gap-2 border px-3 py-1.5 font-mono text-[0.6rem] tracking-[0.24em] uppercase">
							<span aria-hidden className="size-1.5 shrink-0 bg-emerald-500" />
							Game night, ranked
						</span>
						<h1 className="mx-auto mt-6 max-w-4xl font-mono text-[clamp(2rem,10.5vw,5.5rem)] leading-[0.9] font-bold tracking-[-0.055em] uppercase">
							<span className="block">Settle</span>
							<span className="block text-[var(--blue-600)] dark:text-[var(--blue-300)]">
								every rivalry.
							</span>
						</h1>
						<p className="text-muted-foreground mx-auto mt-6 max-w-xl text-pretty text-sm leading-relaxed sm:text-base">
							<span className="text-foreground font-semibold">
								Where every point counts, every victory matters.
							</span>{" "}
							One league for foosball, darts, pool and every game you refuse to lose at.
						</p>
						<div className="mt-8 flex flex-col items-center gap-4">
							<div className="flex flex-col items-center gap-3 sm:flex-row">
								<LandingCta href={primaryHref} size="lg">
									{primaryLabel}
									<HugeiconsIcon icon={ArrowRight02Icon} className="size-4" />
								</LandingCta>
								<LandingCta href={GITHUB_URL} size="lg" variant="quiet" external>
									<HugeiconsIcon icon={GithubIcon} className="size-4" />
									View on GitHub
								</LandingCta>
							</div>
							<ul className="text-muted-foreground flex flex-wrap justify-center gap-x-4 gap-y-2 font-mono text-[0.6rem] tracking-[0.16em] uppercase">
								<li>Free</li>
								<li aria-hidden className="text-border">
									/
								</li>
								<li>Open source (MIT)</li>
								<li aria-hidden className="text-border">
									/
								</li>
								<li>No ads</li>
								<li aria-hidden className="text-border">
									/
								</li>
								<li>No tiers</li>
							</ul>
						</div>
					</div>
					<div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
						<figure
							aria-label="Product preview: the Scorebrawl league dashboard with live standings for a sample Office Foosball league"
							className="relative"
						>
							<div className="text-muted-foreground mb-3 flex items-end justify-between gap-3 font-mono text-[0.6rem] tracking-[0.2em] uppercase">
								<span>Product preview / sample league</span>
								<span className="hidden sm:inline">Autumn 2026</span>
							</div>
							<div inert aria-hidden="true">
								<AppPreview />
							</div>
						</figure>
					</div>
				</section>
				<div id="hero-end" aria-hidden className="h-px w-full" />

				<LiveSessions />
				<Features />
				<Everywhere />

				<section className="border-t">
					<div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
						<div className="border-border bg-card relative overflow-hidden border px-6 py-14 text-center sm:px-12">
							<div aria-hidden className="bg-primary absolute inset-x-0 top-0 h-px" />
							<p className="text-muted-foreground font-mono text-[0.6rem] tracking-[0.3em] uppercase">
								No excuses
							</p>
							<h2 className="mx-auto mt-4 max-w-2xl font-mono text-3xl leading-[0.98] font-bold tracking-[-0.03em] text-balance uppercase sm:text-5xl">
								Your rivals are already 1-0 up.
							</h2>
							<p className="text-muted-foreground mx-auto mt-4 max-w-md text-pretty text-sm leading-relaxed">
								Start a league, invite the people you hate losing to, and let the table settle it.
							</p>
							<div className="mt-8 flex flex-col items-center gap-4">
								<LandingCta href={primaryHref} size="lg">
									{primaryLabel}
									<HugeiconsIcon icon={ArrowRight02Icon} className="size-4" />
								</LandingCta>
								<p className="text-muted-foreground font-mono text-[0.6rem] tracking-[0.16em] uppercase">
									Free / Open source (MIT) / No ads / No tiers
								</p>
							</div>
						</div>
					</div>
				</section>
			</main>

			<footer className="border-t">
				<div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-end md:justify-between">
					<div>
						<div className="flex items-center gap-2.5">
							<span aria-hidden className="flex">
								<BrandMark className="size-8" />
							</span>
							<span className="font-mono text-sm font-bold tracking-[0.18em] uppercase">
								Scorebrawl
							</span>
						</div>
						<p className="text-muted-foreground mt-3 max-w-sm text-pretty text-sm">
							Where every point counts, every victory matters.
						</p>
						<p className="text-muted-foreground mt-2 font-mono text-[0.6rem] tracking-[0.16em] uppercase">
							Free / Open source (MIT) / No ads / No tiers
						</p>
					</div>
					<nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
						<a
							href={GITHUB_URL}
							target="_blank"
							rel="noreferrer"
							className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center font-mono text-[0.65rem] tracking-[0.14em] uppercase transition-colors"
						>
							GitHub
						</a>
						<a
							href={LICENSE_URL}
							target="_blank"
							rel="noreferrer"
							className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center font-mono text-[0.65rem] tracking-[0.14em] uppercase transition-colors"
						>
							MIT License
						</a>
					</nav>
				</div>
			</footer>

			{showStickyCta && (
				<div className="bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
					<LandingCta href={primaryHref} className="w-full">
						{primaryLabel}
						<HugeiconsIcon icon={ArrowRight02Icon} className="size-4" />
					</LandingCta>
				</div>
			)}
		</div>
	);
};

export default Landing;
