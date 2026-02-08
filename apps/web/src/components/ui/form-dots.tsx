import { cn } from "@/lib/utils";

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
			{form.map((result, index) => {
				const baseClasses = "w-2 h-2 rounded-full";
				const colorClasses = {
					W: "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]",
					D: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]",
					L: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]",
				}[result];

				return (
					<div key={`form-${index}-${result}`} className={cn(baseClasses, colorClasses)} />
				);
			})}
		</div>
	);
}
