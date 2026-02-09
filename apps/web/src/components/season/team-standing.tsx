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
import { cn } from "@/lib/utils";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserMultipleIcon } from "@hugeicons/core-free-icons";

const getAssetUrl = (key: string | null | undefined): string | null => {
	if (!key) return null;
	if (key.startsWith("http://") || key.startsWith("https://")) {
		return key;
	}
	return `/api/user-assets/${key}`;
};

function TeamIcon({ logo, name }: { logo: string | null; name: string }) {
	const [hasError, setHasError] = useState(false);
	const logoUrl = getAssetUrl(logo);

	if (!logoUrl || hasError) {
		return (
			<div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10">
				<HugeiconsIcon icon={UserMultipleIcon} className="size-4 text-blue-500" />
			</div>
		);
	}

	return (
		<div className="flex h-6 w-6 items-center justify-center rounded-lg overflow-hidden">
			<img
				src={logoUrl}
				alt={name}
				className="h-full w-full object-cover"
				onError={() => setHasError(true)}
			/>
		</div>
	);
}

interface TeamStandingProps {
	seasonId: string;
	seasonSlug: string;
	maxRows?: number;
	currentPage?: number;
	onPageChange?: (page: number) => void;
}

export function TeamStanding({
	seasonId,
	seasonSlug,
	maxRows,
	currentPage: controlledPage,
}: TeamStandingProps) {
	const { teamStandings } = useTeamStandings(seasonId, seasonSlug);
	const [internalPage] = useState(0);
	const currentPage = controlledPage ?? internalPage;

	if (teamStandings.length === 0) {
		return (
			<div className="flex items-center justify-center h-40 text-muted-foreground">
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
		<div className="rounded-md">
			<Table>
				<TableHeader className="text-xs">
					<TableRow>
						<TableHead>Team</TableHead>
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
					{paginatedData.map((item) => (
						<TableRow key={item.id} className="h-14">
							<TableCell className="py-2">
								<div className="flex items-center gap-2">
									<TeamIcon logo={item.logo} name={item.name} />
									<span className="font-medium">{item.name}</span>
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
					{emptyRows.map((i) => (
						<TableRow key={`empty-${i}`} className="h-14">
							<TableCell colSpan={8} />
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
