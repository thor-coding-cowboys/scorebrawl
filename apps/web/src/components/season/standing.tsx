import { useStandings } from "@/lib/collections";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { StreakAvatar } from "./streak-avatar";
import { FormDots } from "@/components/ui/form-dots";
import { calculateStreak } from "@/lib/streak";
import { FormBar } from "./form-bar";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";

interface StandingProps {
	seasonSlug: string;
	leagueSlug?: string;
}

function MobileStandingRow({
	item,
	leagueSlug,
	onClick,
}: {
	item: {
		id: string;
		name: string;
		image: string | null;
		playerId: string;
		score: number;
		matchCount: number;
		winCount: number;
		pointDiff: number;
		form: ("W" | "D" | "L")[] | undefined;
	};
	leagueSlug?: string;
	onClick?: () => void;
}) {
	const winPct = item.matchCount > 0 ? Math.round((item.winCount / item.matchCount) * 100) : 0;
	const streak = calculateStreak(item.form);

	return (
		<div
			className={cn(
				"flex items-center gap-2 bg-card px-1 py-3",
				leagueSlug && "cursor-pointer hover:bg-muted/50"
			)}
			onClick={onClick}
			data-testid={`standing-row-${item.id}`}
		>
			<StreakAvatar
				src={item.image}
				name={item.name}
				streak={streak}
				size={32}
				className="shrink-0 self-center"
			/>

			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<span className="truncate text-sm font-medium" data-testid={`standing-name-${item.id}`}>
					{item.name}
				</span>
				<div className="flex items-center gap-2">
					<span
						className="text-xs text-muted-foreground tabular-nums"
						data-testid={`standing-mp-${item.id}`}
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
				data-testid={`standing-score-${item.id}`}
			>
				{item.score}
			</span>
		</div>
	);
}

export function Standing({ seasonSlug, leagueSlug }: StandingProps) {
	const { standings } = useStandings(seasonSlug);
	const navigate = useNavigate();

	if (standings.length === 0) {
		return (
			<div
				className="flex items-center justify-center h-40 text-muted-foreground"
				data-testid="standings-empty"
			>
				No matches registered
			</div>
		);
	}

	const sortedData = [...standings].sort((a, b) => {
		if (a.matchCount === 0 && b.matchCount !== 0) return 1;
		if (a.matchCount !== 0 && b.matchCount === 0) return -1;
		return b.score - a.score;
	});

	return (
		<div className="rounded-md" data-testid="standings-table">
			{/* Mobile View - Card List */}
			<div className="md:hidden flex flex-col divide-y divide-border">
				{sortedData.map((item) => (
					<MobileStandingRow
						key={item.id}
						item={item}
						leagueSlug={leagueSlug}
						onClick={
							leagueSlug
								? () =>
										navigate({
											to: "/leagues/$slug/players/$leaguePlayerId",
											params: { slug: leagueSlug, leaguePlayerId: item.playerId },
										})
								: undefined
						}
					/>
				))}
			</div>

			{/* Desktop View - Table */}
			<div className="hidden md:block">
				<Table>
					<TableHeader className="text-xs">
						<TableRow>
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
						{sortedData.map((item) => {
							const streak = calculateStreak(item.form);
							return (
								<TableRow
									key={item.id}
									className={cn("h-14", leagueSlug && "cursor-pointer hover:bg-muted/50")}
									data-testid={`standing-row-${item.id}`}
									onClick={
										leagueSlug
											? () =>
													navigate({
														to: "/leagues/$slug/players/$leaguePlayerId",
														params: { slug: leagueSlug, leaguePlayerId: item.playerId },
													})
											: undefined
									}
								>
									<TableCell className="py-2 w-full max-w-0">
										<div className="flex items-center gap-3 min-w-0">
											<StreakAvatar
												src={item.image}
												name={item.name}
												streak={streak}
												size={32}
												className="shrink-0"
											/>
											<span
												className="font-medium truncate"
												data-testid={`standing-name-${item.id}`}
											>
												{item.name}
											</span>
										</div>
									</TableCell>
									<TableCell
										className="text-center text-muted-foreground"
										data-testid={`standing-mp-${item.id}`}
									>
										{item.matchCount}
									</TableCell>
									<TableCell
										className="text-center text-muted-foreground"
										data-testid={`standing-wins-${item.id}`}
									>
										{item.winCount}
									</TableCell>
									<TableCell
										className="text-center text-muted-foreground"
										data-testid={`standing-draws-${item.id}`}
									>
										{item.drawCount}
									</TableCell>
									<TableCell
										className="text-center text-muted-foreground"
										data-testid={`standing-losses-${item.id}`}
									>
										{item.lossCount}
									</TableCell>
									<TableCell
										className="text-center text-muted-foreground"
										data-testid={`standing-wr-${item.id}`}
									>
										{item.matchCount > 0
											? `${Math.round((item.winCount / item.matchCount) * 100)}%`
											: "-"}
									</TableCell>
									<TableCell className="text-center" data-testid={`standing-diff-${item.id}`}>
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
										data-testid={`standing-score-${item.id}`}
									>
										{item.score}
									</TableCell>
									<TableCell>
										<FormDots form={item.form} />
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
