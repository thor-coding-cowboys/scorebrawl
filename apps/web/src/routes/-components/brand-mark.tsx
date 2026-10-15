import { cn } from "@/lib/utils";

export const BrandMark = ({ className }: { className?: string }) => (
	<img
		src="/landing/scorebrawl-logo.png"
		alt="Scorebrawl"
		className={cn("shrink-0 object-contain", className)}
	/>
);
