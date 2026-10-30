import { formColors, formDotStyle } from "@/lib/theme-tokens";

interface FormBarProps {
	form: ("W" | "D" | "L")[] | undefined;
	delta: number;
}

export function FormBar({ form, delta }: FormBarProps) {
	const deltaColor = delta > 0 ? formColors.W : formColors.L;

	if (!form || form.length === 0) {
		return (
			<div className="flex items-center gap-2">
				<span className="text-muted-foreground text-xs">-</span>
				{delta !== 0 && (
					<span className="text-xs font-medium" style={{ color: deltaColor }}>
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
				{[...form].reverse().map((result, i) => (
					<span
						key={`${result}-${i}`}
						className="size-1.5 rounded-full"
						style={formDotStyle(result)}
					/>
				))}
			</div>
			{delta !== 0 && (
				<span className="text-xs font-medium tabular-nums" style={{ color: deltaColor }}>
					{delta > 0 ? "+" : ""}
					{delta}
				</span>
			)}
		</div>
	);
}
