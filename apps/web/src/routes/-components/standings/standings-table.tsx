import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { StreakAvatar } from "@/components/streak-avatar";
import { FormDots } from "@/components/ui/form-dots";
import { FormBar } from "./form-bar";
import {
	calculateStreak,
	type StandingFormResult,
} from "@coding-cowboys/scorebrawl-core/presentation";
import { cn } from "@/lib/utils";

export type StandingsRow = {
	id: string;
	playerId?: string;
	name: string;
	image?: string | null;
	score: number;
	matchCount: number;
	winCount: number;
	drawCount: number;
	lossCount: number;
	pointDiff: number;
	form?: StandingFormResult[];
	rank?: number;
};

function rankAccent(rank?: number) {
	if (rank === 1) return "text-amber-400 font-semibold";
	if (rank === 2) return "text-zinc-300";
	if (rank === 3) return "text-amber-700";
	return "text-muted-foreground";
}

interface StandingsTableProps {
	rows: StandingsRow[];
	onRowClick?: (row: StandingsRow) => void;
	showRank?: boolean;
	highlightIds?: Set<string>;
	emptyLabel?: string;
}

function MobileStandingRow({
	row,
	showRank,
	onClick,
	dimmed,
}: {
	row: StandingsRow;
	showRank?: boolean;
	onClick?: () => void;
	dimmed?: boolean;
}) {
	const streak = calculateStreak(row.form);

	return (
		<div
			className={cn(
				"flex items-center gap-2 bg-card px-1 py-3",
				onClick && "cursor-pointer hover:bg-muted/50",
				dimmed && "opacity-40"
			)}
			onClick={onClick}
			data-testid={`standing-row-${row.id}`}
		>
			{showRank && (
				<span
					className={cn(
						"w-5 shrink-0 text-center text-xs font-medium tabular-nums",
						rankAccent(row.rank)
					)}
				>
					{row.rank}
				</span>
			)}
			<StreakAvatar
				src={row.image}
				name={row.name}
				streak={streak}
				size={32}
				className="shrink-0 self-center"
			/>

			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="truncate text-sm font-medium" data-testid={`standing-name-${row.id}`}>
					{row.name}
				</span>
				<div className="flex items-center gap-2">
					<span
						className="text-xs text-muted-foreground tabular-nums"
						data-testid={`standing-mp-${row.id}`}
					>
						{row.matchCount}
					</span>
					<span className="text-xs text-muted-foreground tabular-nums">
						{row.matchCount > 0 ? `${Math.round((row.winCount / row.matchCount) * 100)}% W` : "–"}
					</span>
					<FormBar form={row.form} delta={row.pointDiff} />
				</div>
			</div>

			<span
				className={cn(
					"shrink-0 text-base font-bold tabular-nums",
					row.matchCount === 0 && "text-muted-foreground font-normal text-sm"
				)}
				data-testid={`standing-score-${row.id}`}
			>
				{row.score}
			</span>
		</div>
	);
}

export function StandingsTable({
	rows,
	onRowClick,
	showRank,
	highlightIds,
	emptyLabel = "No matches registered",
}: StandingsTableProps) {
	if (rows.length === 0) {
		return (
			<div
				className="flex items-center justify-center h-40 text-muted-foreground"
				data-testid="standings-empty"
			>
				{emptyLabel}
			</div>
		);
	}

	return (
		<div className="rounded-md" data-testid="standings-table">
			{/* Mobile View - Card List */}
			<div className="md:hidden flex flex-col divide-y divide-border">
				{rows.map((row) => (
					<MobileStandingRow
						key={row.id}
						row={row}
						showRank={showRank}
						dimmed={highlightIds ? !highlightIds.has(row.id) : false}
						onClick={onRowClick ? () => onRowClick(row) : undefined}
					/>
				))}
			</div>

			{/* Desktop View - Table */}
			<div className="hidden md:block">
				<Table>
					<TableHeader className="text-xs">
						<TableRow>
							{showRank && (
								<TableHead className="w-10 text-center text-muted-foreground">#</TableHead>
							)}
							<TableHead>Name</TableHead>
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
						{rows.map((row) => {
							const streak = calculateStreak(row.form);
							const isDimmed = highlightIds ? !highlightIds.has(row.id) : false;
							return (
								<TableRow
									key={row.id}
									className={cn(
										"h-14",
										onRowClick && "cursor-pointer hover:bg-muted/50",
										isDimmed && "opacity-40"
									)}
									data-testid={`standing-row-${row.id}`}
									onClick={onRowClick ? () => onRowClick(row) : undefined}
								>
									{showRank && (
										<TableCell className={cn("text-center tabular-nums", rankAccent(row.rank))}>
											{row.rank}
										</TableCell>
									)}
									<TableCell className="py-2 w-full max-w-0">
										<div className="flex items-center gap-3 min-w-0">
											<StreakAvatar
												src={row.image}
												name={row.name}
												streak={streak}
												size={32}
												className="shrink-0"
											/>
											<span
												className="font-medium truncate"
												data-testid={`standing-name-${row.id}`}
											>
												{row.name}
											</span>
										</div>
									</TableCell>
									<TableCell
										className="text-center text-muted-foreground"
										data-testid={`standing-mp-${row.id}`}
									>
										{row.matchCount}
									</TableCell>
									<TableCell
										className="text-center text-muted-foreground"
										data-testid={`standing-wins-${row.id}`}
									>
										{row.winCount}
									</TableCell>
									<TableCell
										className="text-center text-muted-foreground"
										data-testid={`standing-draws-${row.id}`}
									>
										{row.drawCount}
									</TableCell>
									<TableCell
										className="text-center text-muted-foreground"
										data-testid={`standing-losses-${row.id}`}
									>
										{row.lossCount}
									</TableCell>
									<TableCell className="text-center text-muted-foreground">
										{row.matchCount > 0
											? `${Math.round((row.winCount / row.matchCount) * 100)}%`
											: "-"}
									</TableCell>
									<TableCell className="text-center" data-testid={`standing-diff-${row.id}`}>
										<span
											className={cn(
												"font-medium",
												row.pointDiff > 0 && "text-green-600",
												row.pointDiff < 0 && "text-red-600",
												row.pointDiff === 0 && "text-muted-foreground"
											)}
										>
											{row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
										</span>
									</TableCell>
									<TableCell
										className={cn(
											"text-center text-base font-bold",
											row.matchCount === 0 && "text-muted-foreground font-normal text-sm"
										)}
										data-testid={`standing-score-${row.id}`}
									>
										{row.score}
									</TableCell>
									<TableCell>
										<FormDots form={row.form} />
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
