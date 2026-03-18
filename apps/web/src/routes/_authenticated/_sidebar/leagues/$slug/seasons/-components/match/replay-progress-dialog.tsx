import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle01Icon, Loading02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface ReplayStep {
	matchNumber: number;
	status: "pending" | "processing" | "completed";
	isEdit?: boolean;
}

interface ReplayProgressDialogProps {
	isOpen: boolean;
	totalMatches: number;
	currentStep: number;
	mode: "edit" | "insert";
	editMatchNumber?: number;
}

export function ReplayProgressDialog({
	isOpen,
	totalMatches,
	currentStep,
	mode,
	editMatchNumber,
}: ReplayProgressDialogProps) {
	const [steps, setSteps] = useState<ReplayStep[]>([]);

	useEffect(() => {
		// Build steps array
		const newSteps: ReplayStep[] = [];

		if (mode === "edit" && editMatchNumber) {
			// For edit: show all matches from edit point to end
			for (let i = editMatchNumber; i <= totalMatches; i++) {
				newSteps.push({
					matchNumber: i,
					status:
						i < editMatchNumber + currentStep
							? "completed"
							: i === editMatchNumber + currentStep
								? "processing"
								: "pending",
					isEdit: i === editMatchNumber,
				});
			}
		} else {
			// For insert: show from insert point to end
			const startNumber = editMatchNumber || 1;
			for (let i = startNumber; i <= totalMatches; i++) {
				newSteps.push({
					matchNumber: i,
					status:
						i < startNumber + currentStep
							? "completed"
							: i === startNumber + currentStep
								? "processing"
								: "pending",
				});
			}
		}

		setSteps(newSteps);
	}, [totalMatches, currentStep, mode, editMatchNumber]);

	const progress = Math.min(100, Math.round((currentStep / (steps.length || 1)) * 100));

	return (
		<Dialog open={isOpen}>
			<DialogContent className="sm:max-w-md" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<HugeiconsIcon icon={Loading02Icon} className="size-5 animate-spin" />
						Recalculating Rankings...
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Progress bar */}
					<div className="space-y-2">
						<div className="flex justify-between text-sm text-muted-foreground">
							<span>Progress</span>
							<span>{progress}%</span>
						</div>
						<Progress value={progress} className="h-2" />
					</div>

					{/* Match steps visualization */}
					<div className="space-y-2 max-h-64 overflow-y-auto">
						{steps.map((step, index) => (
							<div
								key={step.matchNumber}
								className={cn(
									"flex items-center gap-3 p-3 rounded-lg border transition-all duration-300",
									step.status === "completed" &&
										"bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-800",
									step.status === "processing" &&
										"bg-blue-50/50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800 animate-pulse",
									step.status === "pending" && "bg-muted/30 border-muted",
									step.isEdit && "ring-2 ring-amber-400 ring-offset-2"
								)}
								style={{
									animationDelay: `${index * 50}ms`,
								}}
							>
								<div className="flex-shrink-0">
									{step.status === "completed" && (
										<HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-5 text-green-600" />
									)}
									{step.status === "processing" && (
										<HugeiconsIcon
											icon={Loading02Icon}
											className="size-5 text-blue-600 animate-spin"
										/>
									)}
									{step.status === "pending" && (
										<div className="size-5 rounded-full border-2 border-muted-foreground/30" />
									)}
								</div>

								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="font-mono text-sm font-medium">Match #{step.matchNumber}</span>
										{step.isEdit && (
											<span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-medium">
												EDITED
											</span>
										)}
									</div>
									<p className="text-xs text-muted-foreground">
										{step.status === "completed" && "Elo recalculated"}
										{step.status === "processing" && "Recalculating Elo..."}
										{step.status === "pending" && "Waiting..."}
									</p>
								</div>
							</div>
						))}
					</div>

					{/* Status message */}
					<div className="text-center text-sm text-muted-foreground">
						{currentStep === 0 && "Preparing to recalculate..."}
						{currentStep > 0 &&
							currentStep < steps.length &&
							`Processing match ${currentStep} of ${steps.length}...`}
						{currentStep >= steps.length && "Finalizing..."}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
