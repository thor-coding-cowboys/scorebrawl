import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RowCardProps {
	icon: ReactNode;
	title: string | ReactNode;
	subtitle: ReactNode;
	children?: ReactNode;
	className?: string;
	iconClassName?: string;
	onClick?: () => void;
}

export function RowCard({ icon, title, subtitle, children, className, iconClassName, onClick }: RowCardProps) {
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (onClick && (e.key === "Enter" || e.key === " ")) {
			e.preventDefault();
			onClick();
		}
	};

	return (
		<div 
			className={cn("p-4 hover:bg-muted/50 transition-colors cursor-pointer", onClick && "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset", className)}
			onClick={onClick}
			onKeyDown={handleKeyDown}
			tabIndex={onClick ? 0 : undefined}
			role={onClick ? "button" : undefined}
		>
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
					{iconClassName ? (
						<div className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg", iconClassName)}>
							{icon}
						</div>
					) : (
						<div className="flex h-10 w-10 flex-shrink-0 items-center justify-center">
							{icon}
						</div>
					)}
					<div className="min-w-0">
						<p className="font-medium text-sm truncate">{title}</p>
						<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
							{subtitle}
						</div>
					</div>
				</div>
				{children && (
					<div className="flex items-center gap-2 flex-shrink-0">
						{children}
					</div>
				)}
			</div>
		</div>
	);
}
