import { Button } from "@/components/ui/button";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

interface EditPasskeyDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onSave: (name: string) => void;
	currentName: string;
	isSaving: boolean;
}

export function EditPasskeyDialog({
	isOpen,
	onClose,
	onSave,
	currentName,
	isSaving,
}: EditPasskeyDialogProps) {
	const [name, setName] = useState(currentName);

	useEffect(() => {
		setName(currentName);
	}, [currentName]);

	const handleSave = () => {
		if (name.trim()) {
			onSave(name.trim());
		}
	};

	const handleCancel = () => {
		setName(currentName);
		onClose();
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
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
							Edit Passkey Name
						</DialogTitle>
					</div>
					<p className="text-sm text-muted-foreground mt-2">Update the name of your passkey</p>
				</DialogHeader>

				<div className="relative z-10 overflow-y-auto max-h-[calc(95vh-140px)] p-6">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							handleSave();
						}}
						className="space-y-6"
					>
						<FieldGroup className="space-y-4">
							<Field>
								<FieldLabel className="font-mono text-xs font-medium tracking-wide mb-0.5">
									Passkey Name
								</FieldLabel>
								<Input
									value={name}
									onChange={(e) => setName(e.target.value)}
									className="h-8 font-mono focus:border-purple-500 focus:ring-purple-500/20 text-sm"
									placeholder="My Passkey"
									autoFocus
								/>
							</Field>
						</FieldGroup>

						{/* Action Buttons */}
						<div className="flex gap-4 pt-2">
							<Button
								type="button"
								variant="outline"
								onClick={handleCancel}
								className="font-mono h-8 text-sm"
								disabled={isSaving}
							>
								Cancel
							</Button>
							<GlowButton
								type="submit"
								glowColor={glowColors.blue}
								disabled={isSaving || !name.trim()}
								className="flex-1 font-mono h-8 text-sm"
							>
								{isSaving ? "Saving..." : "Save Changes"}
							</GlowButton>
						</div>
					</form>
				</div>
			</DialogContent>
		</Dialog>
	);
}
