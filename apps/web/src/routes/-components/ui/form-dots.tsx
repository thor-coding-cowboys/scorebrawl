import { formDotStyle } from "@/lib/theme-tokens";

interface FormDotsProps {
	form: ("W" | "D" | "L")[] | undefined;
}

export function FormDots({ form }: FormDotsProps) {
	if (!form || form.length === 0) {
		return (
			<div className="flex gap-1 justify-center">
				<span className="text-muted-foreground text-xs">-</span>
			</div>
		);
	}

	return (
		<div className="flex gap-1 justify-center">
			{[...form].reverse().map((result, index) => {
				return (
					<div
						key={`form-${index}-${result}`}
						className="w-2 h-2 rounded-full"
						style={formDotStyle(result, true)}
					/>
				);
			})}
		</div>
	);
}
