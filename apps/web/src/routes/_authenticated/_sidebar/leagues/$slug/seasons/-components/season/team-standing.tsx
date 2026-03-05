import { useTeamStandings } from "@/lib/collections";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { FormDots } from "@/components/ui/form-dots";
import { StreakAvatar } from "@/components/streak-avatar";
import { calculateStreak } from "@/lib/streak";
import { FormBar } from "./form-bar";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

interface TeamStandingProps {
	seasonSlug: string;
	leagueSlug?: string;
	maxRows?: number;
	currentPage?: number;
	onPageChange?: (page: number) => void;
	highlightPlayerIds?: Set<string>;
}

function MobileTeamStandingRow({
	item,
	leagueSlug,
	onClick,
	dimmed,
}: {
	item: {
		id: string;
		name: string;
		logo: string | null;
		leagueTeamId: string;
		score: number;
		matchCount: number;
		winCount: number;
		pointDiff: number;
		form: ("W" | "D" | "L")[] | undefined;
	};
	leagueSlug?: string;
	onClick?: () => void;
	dimmed?: boolean;
}) {
	const winPct = item.matchCount > 0 ? Math.round((item.winCount / item.matchCount) * 100) : 0;
	const streak = calculateStreak(item.form);

	return (
		<div
			className={cn(
				"flex items-center gap-2 bg-card px-1 py-3",
				leagueSlug && "cursor-pointer hover:bg-muted/50",
				dimmed && "opacity-40"
			)}
			onClick={onClick}
			data-testid={`team-standing-row-${item.id}`}
		>
			<StreakAvatar
				src={item.logo}
				name={item.name}
				streak={streak}
				size={32}
				className="shrink-0 self-center"
			/>

			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span
					className="truncate text-sm font-medium"
					data-testid={`team-standing-name-${item.id}`}
				>
					{item.name}
				</span>
				<div className="flex items-center gap-2">
					<span
						className="text-xs text-muted-foreground tabular-nums"
						data-testid={`team-standing-mp-${item.id}`}
					>
						{item.matchCount}
					</span>
					<span className="text-xs text-muted-foreground tabular-nums">{winPct}% W</span>
					<FormBar form={item.form} delta={item.pointDiff} />
				</div>
			</div>

			<span
				className={cn(
					"shrink-0 text-base font-bold tabular-nums",
					item.matchCount === 0 && "text-muted-foreground font-normal text-sm"
				)}
				data-testid={`team-standing-score-${item.id}`}
			>
				{item.score}
			</span>
		</div>
	);
}

export function TeamStanding({
	seasonSlug,
	leagueSlug,
	maxRows,
	currentPage: controlledPage,
	highlightPlayerIds,
}: TeamStandingProps) {
	const { teamStandings, isLoading, error } = useTeamStandings(seasonSlug);
	const navigate = useNavigate();
	const [internalPage] = useState(0);
	const currentPage = controlledPage ?? internalPage;

	if (error) {
		return (
			<div
				className="flex items-center justify-center h-40 text-destructive"
				data-testid="team-standings-error"
			>
				Error loading team standings: {error.message}
			</div>
		);
	}

	if (isLoading) {
		return (
			<div
				className="flex items-center justify-center h-40 text-muted-foreground"
				data-testid="team-standings-loading"
			>
				Loading team standings...
			</div>
		);
	}

	if (teamStandings.length === 0) {
		return (
			<div
				className="flex items-center justify-center h-40 text-muted-foreground"
				data-testid="team-standings-empty"
			>
				No team standings
			</div>
		);
	}

	const sortedData = [...teamStandings].sort((a, b) => {
		if (a.matchCount === 0 && b.matchCount !== 0) return 1;
		if (a.matchCount !== 0 && b.matchCount === 0) return -1;
		return b.score - a.score;
	});

	const pageSize = maxRows ?? sortedData.length;
	const startIndex = currentPage * pageSize;
	const endIndex = startIndex + pageSize;
	const paginatedData = sortedData.slice(startIndex, endIndex);

	// Add empty rows to maintain consistent height
	const emptyRowsCount = maxRows ? Math.max(0, maxRows - paginatedData.length) : 0;
	const emptyRows = Array.from({ length: emptyRowsCount }, (_, i) => i);

	return (
		<div className="rounded-md" data-testid="team-standings-table">
			{/* Mobile View - Card List */}
			<div className="md:hidden flex flex-col divide-y divide-border">
				{paginatedData.map((item) => {
					const isDimmed = highlightPlayerIds
						? !item.players.every((p) => highlightPlayerIds.has(p.id))
						: false;
					return (
						<MobileTeamStandingRow
							key={item.id}
							item={item}
							leagueSlug={leagueSlug}
							dimmed={isDimmed}
							onClick={
								leagueSlug
									? () =>
											navigate({
												to: "/leagues/$slug/teams/$teamId",
												params: { slug: leagueSlug, teamId: item.leagueTeamId },
											})
									: undefined
							}
						/>
					);
				})}
			</div>

			{/* Desktop View - Table */}
			<div className="hidden md:block">
				<Table>
					<TableHeader className="text-xs">
						<TableRow>
							<TableHead>Team</TableHead>
							<TableHead className="text-center text-muted-foreground">MP</TableHead>
							<TableHead className="text-center text-muted-foreground">W</TableHead>
							<TableHead className="text-center text-muted-foreground">D</TableHead>
							<TableHead className="text-center text-muted-foreground">L</TableHead>
							<TableHead className="text-center text-muted-foreground">Win%</TableHead>
							<TableHead className="text-center">+/-</TableHead>
							<TableHead className="font-bold text-center">Pts</TableHead>
							<TableHead className="text-center text-muted-foreground">Last 5</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody className="text-sm">
						{paginatedData.map((item) => {
							const streak = calculateStreak(item.form);
							const isDimmed = highlightPlayerIds
								? !item.players.every((p) => highlightPlayerIds.has(p.id))
								: false;
							return (
								<TableRow
									key={item.id}
									className={cn(
										"h-14",
										leagueSlug && "cursor-pointer hover:bg-muted/50",
										isDimmed && "opacity-40"
									)}
									data-testid={`team-standing-row-${item.id}`}
									onClick={() =>
										leagueSlug &&
										navigate({
											to: "/leagues/$slug/teams/$teamId",
											params: { slug: leagueSlug, teamId: item.leagueTeamId },
										})
									}
								>
									<TableCell className="py-2 w-full max-w-0">
										<div className="flex items-center gap-2 min-w-0">
											<StreakAvatar src={item.logo} name={item.name} streak={streak} size={32} />
											<span
												className="font-medium truncate"
												data-testid={`team-standing-name-${item.id}`}
											>
												{item.name}
											</span>
										</div>
									</TableCell>
									<TableCell
										className="text-center text-muted-foreground"
										data-testid={`team-standing-mp-${item.id}`}
									>
										{item.matchCount}
									</TableCell>
									<TableCell
										className="text-center text-muted-foreground"
										data-testid={`team-standing-wins-${item.id}`}
									>
										{item.winCount}
									</TableCell>
									<TableCell
										className="text-center text-muted-foreground"
										data-testid={`team-standing-draws-${item.id}`}
									>
										{item.drawCount}
									</TableCell>
									<TableCell
										className="text-center text-muted-foreground"
										data-testid={`team-standing-losses-${item.id}`}
									>
										{item.lossCount}
									</TableCell>
									<TableCell
										className="text-center text-muted-foreground"
										data-testid={`team-standing-wr-${item.id}`}
									>
										{item.matchCount > 0
											? `${Math.round((item.winCount / item.matchCount) * 100)}%`
											: "-"}
									</TableCell>
									<TableCell className="text-center" data-testid={`team-standing-diff-${item.id}`}>
										<span
											className={cn(
												"font-medium",
												item.pointDiff > 0 && "text-green-600",
												item.pointDiff < 0 && "text-red-600",
												item.pointDiff === 0 && "text-muted-foreground"
											)}
										>
											{item.pointDiff > 0 ? `+${item.pointDiff}` : item.pointDiff}
										</span>
									</TableCell>
									<TableCell
										className={cn(
											"text-center text-base font-bold",
											item.matchCount === 0 && "text-muted-foreground font-normal text-sm"
										)}
										data-testid={`team-standing-score-${item.id}`}
									>
										{item.score}
									</TableCell>
									<TableCell>
										<FormDots form={item.form} />
									</TableCell>
								</TableRow>
							);
						})}
						{emptyRows.map((i) => (
							<TableRow key={`empty-${i}`} className="h-14">
								<TableCell colSpan={9} />
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
