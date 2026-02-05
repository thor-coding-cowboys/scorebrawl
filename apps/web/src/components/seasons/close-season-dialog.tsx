import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTRPC } from "@/lib/trpc";
import { SecurityLockIcon, Alert02Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

interface Season {
	id: string;
	name: string;
	slug: string;
	closed: boolean;
}

interface CloseSeasonDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess?: () => void;
	season: Season | null;
}

export function CloseSeasonDialog({ isOpen, onClose, onSuccess, season }: CloseSeasonDialogProps) {
	const trpc = useTRPC();
	const [apiError, setApiError] = useState<string>("");

	const closeMutation = useMutation(trpc.season.updateClosedStatus.mutationOptions());

	const isClosed = season?.closed ?? false;

	const handleToggle = async () => {
		setApiError("");

		if (!season) return;

		try {
			await closeMutation.mutateAsync({
				seasonSlug: season.slug,
				closed: !isClosed,
			});

			toast.success(isClosed ? "Season opened successfully" : "Season closed successfully");
			onSuccess?.();
			onClose();
		} catch (err) {
			const message =
				err instanceof Error ? err.message : `Failed to ${isClosed ? "open" : "close"} season`;
			setApiError(message);
			toast.error(message);
		}
	};

	const handleCancel = () => {
		setApiError("");
		onClose();
	};

	if (!season) return null;

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
			<DialogContent className="sm:max-w-md overflow-hidden">
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
				<DialogHeader className="relative z-10 pb-4 border-b border-border">
					<div className="flex items-center gap-3">
						<div
							className={`w-2 h-6 rounded-full shadow-lg ${isClosed ? "bg-emerald-500 shadow-emerald-500/25" : "bg-red-500 shadow-red-500/25"}`}
						/>
						<DialogTitle className="text-xl font-bold font-mono tracking-tight">
							{isClosed ? "Unlock Season" : "Lock Season"}
						</DialogTitle>
					</div>
				</DialogHeader>

				<div className="relative z-10 space-y-4 py-4">
					{/* Icon */}
					<div className="flex justify-center">
						<div
							className={`w-16 h-16 rounded-full flex items-center justify-center ${isClosed ? "bg-emerald-500/10" : "bg-red-500/10"}`}
						>
							<HugeiconsIcon
								icon={SecurityLockIcon}
								className={`w-8 h-8 ${isClosed ? "text-emerald-500" : "text-red-500"}`}
							/>
						</div>
					</div>

					{/* Content */}
					<div className="text-center space-y-2">
						<h3 className="font-mono font-semibold text-lg">
							{isClosed ? `Unlock ${season.name}` : `Lock ${season.name}`}
						</h3>
						<p className="text-muted-foreground text-sm">
							{isClosed
								? "Are you sure you want to unlock this season?"
								: "Are you sure you want to lock this season?"}
						</p>
					</div>

					{/* Info/Warning Box */}
					<div
						className={`border p-4 space-y-2 ${isClosed ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}
					>
						<div className="flex items-start gap-2">
							<HugeiconsIcon
								icon={isClosed ? InformationCircleIcon : Alert02Icon}
								className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isClosed ? "text-emerald-500" : "text-red-500"}`}
							/>
							<div className="space-y-1">
								<p className="text-xs text-muted-foreground">
									{isClosed
										? "Unlocking a season allows new matches to be created and registered again."
										: "Locking a season means that no more matches can be created or registered. You can unlock the season at any time."}
								</p>
							</div>
						</div>
					</div>

					{/* Error Display */}
					{apiError && (
						<div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
							<p className="text-destructive font-mono text-xs">{apiError}</p>
						</div>
					)}

					{/* Action Buttons */}
					<div className="flex gap-3 pt-2">
						<Button
							variant="outline"
							onClick={handleCancel}
							className="flex-1 font-mono h-9 text-sm"
						>
							Cancel
						</Button>
						<Button
							onClick={handleToggle}
							disabled={closeMutation.isPending}
							variant={isClosed ? "default" : "destructive"}
							className="flex-1 font-mono font-bold h-9 text-sm"
						>
							{closeMutation.isPending ? (
								isClosed ? (
									"Unlocking..."
								) : (
									"Locking..."
								)
							) : (
								<>
									<HugeiconsIcon icon={SecurityLockIcon} className="w-4 h-4 mr-2" />
									{isClosed ? "Unlock Season" : "Lock Season"}
								</>
							)}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
