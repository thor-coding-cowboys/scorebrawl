"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SettingsRowProps {
	label: string;
	description?: string | string[];
	children: React.ReactNode;
	className?: string;
}

export function SettingsRow({ label, description, children, className }: SettingsRowProps) {
	return (
		<div className={cn("flex flex-col gap-1", className)}>
			<div className="flex items-center justify-between gap-4">
				<Label className="shrink-0">{label}</Label>
				{children}
			</div>
			{description && (
				<span className="text-[0.65rem] leading-tight text-muted-foreground">
					{Array.isArray(description) ? description.map((line, i) => (
						<>{line}{i < description.length - 1 && <br/>}</>
					)) : description}
				</span>
			)}
		</div>
	);
}
