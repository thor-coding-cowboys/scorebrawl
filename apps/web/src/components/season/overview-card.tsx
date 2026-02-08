import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface OverviewCardProps {
	title: string;
	description?: string;
	children: ReactNode;
	action?: ReactNode;
	className?: string;
}

export function OverviewCard({
	title,
	description,
	children,
	action,
	className,
}: OverviewCardProps) {
	return (
		<Card className={cn(className)}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>{title}</CardTitle>
						{description && <CardDescription>{description}</CardDescription>}
					</div>
					{action && <div>{action}</div>}
				</div>
			</CardHeader>
			<CardContent>{children}</CardContent>
		</Card>
	);
}
