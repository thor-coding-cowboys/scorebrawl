import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";

interface OverviewCardProps {
	title: string;
	description?: string;
	children: ReactNode;
	action?: ReactNode;
}

export function OverviewCard({ title, description, children, action }: OverviewCardProps) {
	return (
		<Card>
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
