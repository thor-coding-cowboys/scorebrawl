import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EditLeagueForm } from "./edit-league-form";

interface EditLeagueDialogProps {
	isOpen: boolean;
	onClose: () => void;
	league: {
		id: string;
		name: string;
		slug: string;
		logo?: string | null;
	};
}

export function EditLeagueDialog({ isOpen, onClose, league }: EditLeagueDialogProps) {
	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-xl max-h-[95vh] overflow-hidden p-0">
				{/* Technical Grid Background */}
				<div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.02] opacity-[0.05]">
					<div
						className="w-full h-full"
						style={{
							backgroundImage:
								"radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
							backgroundSize: "24px 24px",
						}}
					/>
				</div>

				{/* Header */}
				<DialogHeader className="relative z-10 pb-4 border-b border-border p-6">
					<div className="flex items-center gap-3">
						<div className="w-2 h-6 bg-purple-500 rounded-full shadow-lg shadow-purple-500/25" />
						<DialogTitle className="text-xl font-bold font-mono tracking-tight">
							Edit League
						</DialogTitle>
					</div>
					<p className="text-sm text-muted-foreground mt-2">Update your league details</p>
				</DialogHeader>

				<div className="relative z-10 overflow-y-auto max-h-[calc(95vh-140px)] p-6">
					<EditLeagueForm league={league} onCancel={onClose} onSuccess={onClose} />
				</div>
			</DialogContent>
		</Dialog>
	);
}
