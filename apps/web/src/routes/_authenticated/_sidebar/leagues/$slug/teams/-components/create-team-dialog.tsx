import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserMultipleIcon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogoUpload } from "@/components/ui/logo-upload";
import { trpcClient, type RouterOutput } from "@/lib/trpc";

type CreatedTeam = RouterOutput["leagueTeam"]["create"]["team"];

const readFileAsDataUrl = (file: File) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === "string") {
				resolve(reader.result);
			} else {
				reject(new Error("Failed to read file as data URL"));
			}
		};
		reader.onerror = () => reject(new Error("Failed to read file"));
		reader.readAsDataURL(file);
	});

export function CreateTeamDialog({
	open,
	onOpenChange,
	onCreated,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated: (team: CreatedTeam) => void;
}) {
	const [name, setName] = useState("");
	const [logo, setLogo] = useState<File | null>(null);
	const [logoPreview, setLogoPreview] = useState<string | null>(null);

	const reset = () => {
		if (logoPreview) URL.revokeObjectURL(logoPreview);
		setName("");
		setLogo(null);
		setLogoPreview(null);
	};

	const createMutation = useMutation({
		mutationFn: async () => {
			const imageData = logo ? await readFileAsDataUrl(logo) : undefined;
			return await trpcClient.leagueTeam.create.mutate({ name: name.trim(), imageData });
		},
		onSuccess: ({ team }) => {
			toast.success(`Team "${team.name}" created`);
			reset();
			onOpenChange(false);
			onCreated(team);
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : "Failed to create team");
		},
	});

	const handleOpenChange = (next: boolean) => {
		if (!next) reset();
		onOpenChange(next);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader className="pb-4 border-b border-border">
					<div className="flex items-center gap-3">
						<div className="w-2 h-6 bg-blue-500 rounded-full" />
						<DialogTitle className="text-xl font-bold font-mono tracking-tight">
							Create Team
						</DialogTitle>
					</div>
					<DialogDescription className="font-mono text-sm text-muted-foreground">
						Register a team up front. Add players from the team page.
					</DialogDescription>
				</DialogHeader>
				<form
					className="grid gap-4 py-4"
					onSubmit={(e) => {
						e.preventDefault();
						if (name.trim()) createMutation.mutate();
					}}
				>
					<div className="grid gap-2">
						<Label>Team Logo (Optional)</Label>
						<LogoUpload
							previewUrl={logoPreview}
							fallback={<HugeiconsIcon icon={UserMultipleIcon} className="size-12 text-blue-500" />}
							onFileSelect={(file) => {
								if (logoPreview) URL.revokeObjectURL(logoPreview);
								setLogo(file);
								setLogoPreview(URL.createObjectURL(file));
							}}
							onRemove={
								logoPreview
									? () => {
											URL.revokeObjectURL(logoPreview);
											setLogo(null);
											setLogoPreview(null);
										}
									: undefined
							}
							disabled={createMutation.isPending}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="create-team-name">Team Name</Label>
						<Input
							id="create-team-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Enter team name"
							maxLength={100}
							autoFocus
							disabled={createMutation.isPending}
						/>
					</div>
					<DialogFooter>
						<Button type="submit" disabled={createMutation.isPending || !name.trim()}>
							{createMutation.isPending ? "Creating..." : "Create team"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
