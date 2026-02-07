import { useQuery } from "@tanstack/react-query";
import { trpcClient } from "@/lib/trpc";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { cn } from "@/lib/utils";

interface StandingProps {
	slug: string;
	seasonSlug: string;
}

interface StandingItem {
	id: string;
	seasonId: string;
	playerId: string;
	score: number;
	name: string;
	image: string | null;
	userId: string;
	matchCount: number;
	winCount: number;
	lossCount: number;
	drawCount: number;
	rank: number;
	pointDiff: number;
	form: ("W" | "D" | "L")[];
}

function FormDots({ form }: { form: ("W" | "D" | "L")[] }) {
	if (form.length === 0) {
		return (
			<div className="flex gap-1 justify-center">
				<span className="text-muted-foreground text-xs">-</span>
			</div>
		);
	}

	return (
		<div className="flex gap-1 justify-center">
			{form.map((result, index) => {
				let className = "w-2 h-2 rounded-full";
				switch (result) {
					case "W":
						className += " bg-green-600";
						break;
					case "D":
						className += " bg-yellow-600";
						break;
					case "L":
						className += " bg-red-600";
						break;
				}
				return <div key={`form-${index}-${result}`} className={className} />;
			})}
		</div>
	);
}

export function Standing({ slug, seasonSlug }: StandingProps) {
	const { data, isLoading } = useQuery<StandingItem[]>({
		queryKey: ["seasonPlayer", "standing", slug, seasonSlug],
		queryFn: async () => {
			return await trpcClient.seasonPlayer.getStanding.query({ seasonSlug });
		},
	});

	if (isLoading) {
		return <Skeleton className="w-full h-80" />;
	}

	if (!data?.length) {
		return (
			<div className="flex items-center justify-center h-40 text-muted-foreground">
				No matches registered
			</div>
		);
	}

	// Sort: players with 0 matches go to bottom, then by score descending
	const sortedData = [...data].sort((a, b) => {
		if (a.matchCount === 0 && b.matchCount !== 0) return 1;
		if (a.matchCount !== 0 && b.matchCount === 0) return -1;
		return b.score - a.score;
	});

	return (
		<div className="rounded-md">
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
						<TableRow key={item.id} className="h-14">
							<TableCell className="py-2 max-w-[120px]">
								<div className="flex items-center gap-3 min-w-0">
									<AvatarWithFallback
										src={item.image}
										name={item.name}
										size="md"
										className="shrink-0"
									/>
									<span className="font-medium truncate">{item.name}</span>
								</div>
							</TableCell>
							<TableCell
								className={cn("text-center", item.matchCount === 0 && "text-muted-foreground")}
							>
								{item.matchCount}
							</TableCell>
							<TableCell
								className={cn("text-center", item.winCount === 0 && "text-muted-foreground")}
							>
								{item.winCount}
							</TableCell>
							<TableCell
								className={cn("text-center", item.drawCount === 0 && "text-muted-foreground")}
							>
								{item.drawCount}
							</TableCell>
							<TableCell
								className={cn("text-center", item.lossCount === 0 && "text-muted-foreground")}
							>
								{item.lossCount}
							</TableCell>
							<TableCell className="text-center">
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
