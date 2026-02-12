import { Button } from "@/components/ui/button";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface CreateApiKeyDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onCreate: (name: string) => void;
	isCreating: boolean;
}

export function CreateApiKeyDialog({
	isOpen,
	onClose,
	onCreate,
	isCreating,
}: CreateApiKeyDialogProps) {
	const [name, setName] = useState("");

	const handleCreate = () => {
		if (name.trim()) {
			onCreate(name.trim());
		}
	};

	const handleCancel = () => {
		setName("");
		onClose();
	};

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			handleCancel();
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
						<div className="w-2 h-6 bg-blue-500 rounded-full shadow-lg shadow-blue-500/25" />
						<DialogTitle className="text-xl font-bold font-mono tracking-tight">
							Create API Key
						</DialogTitle>
					</div>
					<p className="text-sm text-muted-foreground mt-2">
						Create an API key for external integrations or companion devices
					</p>
				</DialogHeader>

				<div className="relative z-10 overflow-y-auto max-h-[calc(95vh-140px)] p-6">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							handleCreate();
						}}
						className="space-y-6"
					>
						<FieldGroup className="space-y-4">
							<Field>
								<FieldLabel className="font-mono text-xs font-medium tracking-wide mb-0.5">
									Key Name
								</FieldLabel>
								<Input
									value={name}
									onChange={(e) => setName(e.target.value)}
									className="h-8 font-mono focus:border-blue-500 focus:ring-blue-500/20 text-sm"
									placeholder="My Integration"
									autoFocus
								/>
								<p className="text-xs text-muted-foreground mt-1">
									Give your API key a memorable name to identify it later
								</p>
							</Field>
						</FieldGroup>

						{/* Action Buttons */}
						<div className="flex gap-4 pt-2">
							<Button
								type="button"
								variant="outline"
								onClick={handleCancel}
								className="font-mono h-8 text-sm"
								disabled={isCreating}
							>
								Cancel
							</Button>
							<GlowButton
								type="submit"
								glowColor={glowColors.blue}
								disabled={isCreating || !name.trim()}
								className="flex-1 font-mono h-8 text-sm"
							>
								{isCreating ? "Creating..." : "Create Key"}
							</GlowButton>
						</div>
					</form>
				</div>
			</DialogContent>
		</Dialog>
	);
}
