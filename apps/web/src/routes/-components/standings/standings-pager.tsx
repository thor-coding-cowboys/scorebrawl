import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";

interface StandingsPagerProps {
	page: number;
	pageCount: number;
	onPageChange: (page: number) => void;
}

export function StandingsPager({ page, pageCount, onPageChange }: StandingsPagerProps) {
	if (pageCount <= 1) return null;

	return (
		<div className="flex items-center gap-1">
			<span className="mr-1 text-xs text-muted-foreground tabular-nums">
				{page + 1}/{pageCount}
			</span>
			<Button
				variant="ghost"
				size="sm"
				aria-label="Previous page"
				data-testid="standings-page-prev"
				className="min-h-11 min-w-11 text-muted-foreground hover:text-foreground md:min-h-8 md:min-w-8"
				onClick={() => onPageChange(Math.max(0, page - 1))}
				disabled={page === 0}
			>
				<HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
			</Button>
			<Button
				variant="ghost"
				size="sm"
				aria-label="Next page"
				data-testid="standings-page-next"
				className="min-h-11 min-w-11 text-muted-foreground hover:text-foreground md:min-h-8 md:min-w-8"
				onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
				disabled={page === pageCount - 1}
			>
				<HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
			</Button>
		</div>
	);
}
