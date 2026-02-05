import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

interface DashboardCardProps {
	title: string;
	icon: IconSvgElement;
	children: ReactNode;
	glowColor?: string;
	iconColor?: string;
}

export function DashboardCard({ title, icon, children, glowColor, iconColor }: DashboardCardProps) {
	return (
		<Card className="relative overflow-hidden">
			{glowColor && <div className={`absolute inset-0 ${glowColor}`} />}
			<CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium">{title}</CardTitle>
				<HugeiconsIcon icon={icon} className={`size-4 ${iconColor || "text-muted-foreground"}`} />
			</CardHeader>
			<CardContent className="relative">{children}</CardContent>
		</Card>
	);
}
