import { useStandings } from "@/lib/collections";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { FormDots } from "@/components/ui/form-dots";
import { cn } from "@/lib/utils";

interface StandingProps {
	seasonId: string;
	seasonSlug: string;
}

export function Standing({ seasonId, seasonSlug }: StandingProps) {
	const { standings } = useStandings(seasonId, seasonSlug);

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
			<Table>
				<TableHeader className="text-xs">
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead className="text-center">MP</TableHead>
						<TableHead className="text-center">W</TableHead>
						<TableHead className="text-center">D</TableHead>
						<TableHead className="text-center">L</TableHead>
						<TableHead className="text-center">+/-</TableHead>
						<TableHead className="font-bold text-center">Pts</TableHead>
						<TableHead className="hidden md:table-cell text-center">Last 5</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody className="text-sm">
					{sortedData.map((item) => (
						<TableRow key={item.id} className="h-14" data-testid={`standing-row-${item.id}`}>
							<TableCell className="py-2 max-w-[120px]">
								<div className="flex items-center gap-3 min-w-0">
									<AvatarWithFallback
										src={item.image}
										name={item.name}
										size="md"
										className="shrink-0"
									/>
									<span className="font-medium truncate" data-testid={`standing-name-${item.id}`}>
										{item.name}
									</span>
								</div>
							</TableCell>
							<TableCell
								className={cn("text-center", item.matchCount === 0 && "text-muted-foreground")}
								data-testid={`standing-mp-${item.id}`}
							>
								{item.matchCount}
							</TableCell>
							<TableCell
								className={cn("text-center", item.winCount === 0 && "text-muted-foreground")}
								data-testid={`standing-wins-${item.id}`}
							>
								{item.winCount}
							</TableCell>
							<TableCell
								className={cn("text-center", item.drawCount === 0 && "text-muted-foreground")}
								data-testid={`standing-draws-${item.id}`}
							>
								{item.drawCount}
							</TableCell>
							<TableCell
								className={cn("text-center", item.lossCount === 0 && "text-muted-foreground")}
								data-testid={`standing-losses-${item.id}`}
							>
								{item.lossCount}
							</TableCell>
							<TableCell className="text-center" data-testid={`standing-diff-${item.id}`}>
								<span
									className={cn(
										item.pointDiff > 0 && "text-green-600",
										item.pointDiff < 0 && "text-red-600",
										item.matchCount === 0 && "text-muted-foreground"
									)}
								>
									{item.matchCount === 0
										? 0
										: item.pointDiff > 0
											? `+${item.pointDiff}`
											: item.pointDiff}
								</span>
							</TableCell>
							<TableCell
								className={cn(
									"text-center font-bold",
									item.matchCount === 0 && "text-muted-foreground font-normal"
								)}
								data-testid={`standing-score-${item.id}`}
							>
								{item.score}
							</TableCell>
							<TableCell className="hidden md:table-cell">
								<FormDots form={item.form} />
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
