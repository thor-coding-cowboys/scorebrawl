import { cn } from "@/lib/utils";

interface FormBarProps {
	form: ("W" | "D" | "L")[] | undefined;
	delta: number;
}

export function FormBar({ form, delta }: FormBarProps) {
	if (!form || form.length === 0) {
		return (
			<div className="flex items-center gap-2">
				<span className="text-muted-foreground text-xs">-</span>
				{delta !== 0 && (
					<span
						className={cn("text-xs font-medium", delta > 0 ? "text-green-600" : "text-red-600")}
					>
						{delta > 0 ? "+" : ""}
						{delta}
					</span>
				)}
			</div>
		);
	}

	return (
		<div className="flex items-center gap-2">
			<div className="flex items-center gap-1">
				{[...form].reverse().map((result, i) => {
					const colorClasses = {
						W: "bg-green-500",
						D: "bg-amber-500",
						L: "bg-red-500",
					}[result];
					return (
						<span key={`${result}-${i}`} className={cn("size-1.5 rounded-full", colorClasses)} />
					);
				})}
			</div>
			{delta !== 0 && (
				<span
					className={cn(
						"text-xs font-medium tabular-nums",
						delta > 0 ? "text-green-600" : "text-red-600"
					)}
				>
					{delta > 0 ? "+" : ""}
					{delta}
				</span>
			)}
		</div>
	);
}
