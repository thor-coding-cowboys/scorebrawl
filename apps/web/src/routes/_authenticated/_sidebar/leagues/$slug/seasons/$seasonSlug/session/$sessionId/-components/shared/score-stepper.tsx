import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Remove01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export function ScoreStepper({
	label,
	score,
	onIncrement,
	onDecrement,
	disabled = false,
}: {
	label: string;
	score: number;
	onIncrement: () => void;
	onDecrement: () => void;
	disabled?: boolean;
}) {
	return (
		<div className={cn("flex flex-col items-center gap-1 p-4", disabled && "opacity-50")}>
			<div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground font-mono">
				{label}
			</div>
			<div className="flex items-center gap-3">
				<Button
					type="button"
					variant="outline"
					size="icon-sm"
					onClick={onDecrement}
					disabled={disabled || score <= 0}
				>
					<HugeiconsIcon icon={Remove01Icon} className="size-4" />
				</Button>
				<span className="text-5xl font-bold tabular-nums tracking-tighter w-16 text-center font-mono">
					{score}
				</span>
				<Button
					type="button"
					variant="outline"
					size="icon-sm"
					onClick={onIncrement}
					disabled={disabled}
				>
					<HugeiconsIcon icon={Add01Icon} className="size-4" />
				</Button>
			</div>
		</div>
	);
}
