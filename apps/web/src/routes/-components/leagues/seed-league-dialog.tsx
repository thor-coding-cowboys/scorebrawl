import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/slug";
import { useTRPC } from "@/lib/trpc";

const seedLeagueSchema = z.object({
	name: z.string().min(1, "League name is required").max(100, "Name is too long"),
	slug: z
		.string()
		.min(1, "Slug is required")
		.max(100, "Slug is too long")
		.regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
	memberCount: z.number().min(3).max(50),
	matchCount: z.number().min(1).max(500),
});

type SeedLeagueFormValues = z.infer<typeof seedLeagueSchema>;

interface SeedLeagueDialogProps {
	isOpen: boolean;
	onClose: () => void;
}

export function SeedLeagueDialog({ isOpen, onClose }: SeedLeagueDialogProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [slugTouched, setSlugTouched] = useState(false);

	const {
		register,
		handleSubmit,
		setValue,
		reset,
		formState: { errors },
	} = useForm<SeedLeagueFormValues>({
		resolver: zodResolver(seedLeagueSchema),
		defaultValues: {
			name: "Demo League",
			slug: "demo-league",
			memberCount: 8,
			matchCount: 20,
		},
	});

	const seedMutation = useMutation(
		trpc.admin.triggerSeed.mutationOptions({
			onSuccess: () => {
				toast.success("Seed job queued! League will be created shortly.");
				queryClient.invalidateQueries({ queryKey: trpc.league.list.queryKey() });
				reset();
				setSlugTouched(false);
				onClose();
			},
			onError: (error) => {
				toast.error(error.message || "Failed to trigger seed");
			},
		})
	);

	const onSubmit = (values: SeedLeagueFormValues) => {
		seedMutation.mutate({
			leagueName: values.name,
			leagueSlug: values.slug,
			memberCount: values.memberCount,
			matchCount: values.matchCount,
		});
	};

	const handleClose = () => {
		if (!seedMutation.isPending) {
			reset();
			setSlugTouched(false);
			onClose();
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
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
						<div className="w-2 h-6 bg-amber-500 rounded-full shadow-lg shadow-amber-500/25" />
						<DialogTitle className="text-xl font-bold font-mono tracking-tight">
							Seed League
						</DialogTitle>
					</div>
					<p className="text-sm text-muted-foreground mt-2">
						Generate a league with fake members, a season, and matches
					</p>
				</DialogHeader>

				<div className="relative z-10 overflow-y-auto max-h-[calc(95vh-140px)] p-6">
					{/* Warning Banner */}
					<div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 mb-6">
						<p className="text-amber-600 dark:text-amber-400 text-xs font-mono text-center">
							You will be added as owner/admin of the seeded league
						</p>
					</div>

					<form onSubmit={handleSubmit(onSubmit)}>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="seed-name">League Name</FieldLabel>
								<Input
									id="seed-name"
									type="text"
									placeholder="Demo League"
									disabled={seedMutation.isPending}
									{...register("name", {
										onChange: (e) => {
											if (!slugTouched) {
												setValue("slug", slugify(e.target.value));
											}
										},
									})}
								/>
								{errors.name?.message && (
									<p className="text-sm text-destructive">{errors.name.message}</p>
								)}
							</Field>

							<Field>
								<FieldLabel htmlFor="seed-slug">Slug</FieldLabel>
								<Input
									id="seed-slug"
									type="text"
									placeholder="demo-league"
									disabled={seedMutation.isPending}
									{...register("slug")}
									onChange={(e) => {
										setSlugTouched(true);
										register("slug").onChange(e);
									}}
								/>
								{errors.slug?.message && (
									<p className="text-sm text-destructive">{errors.slug.message}</p>
								)}
							</Field>

							<Field>
								<FieldLabel htmlFor="seed-members">Members (3–50)</FieldLabel>
								<Input
									id="seed-members"
									type="number"
									min={3}
									max={50}
									disabled={seedMutation.isPending}
									{...register("memberCount", { valueAsNumber: true })}
								/>
								{errors.memberCount?.message && (
									<p className="text-sm text-destructive">{errors.memberCount.message}</p>
								)}
								<p className="text-xs text-muted-foreground">
									Fake users with accounts (password: Test.1234)
								</p>
							</Field>

							<Field>
								<FieldLabel htmlFor="seed-matches">Matches (1–500)</FieldLabel>
								<Input
									id="seed-matches"
									type="number"
									min={1}
									max={500}
									disabled={seedMutation.isPending}
									{...register("matchCount", { valueAsNumber: true })}
								/>
								{errors.matchCount?.message && (
									<p className="text-sm text-destructive">{errors.matchCount.message}</p>
								)}
								<p className="text-xs text-muted-foreground">2v2 matches with ELO calculations</p>
							</Field>

							<div className="flex gap-4 pt-2">
								<Button
									type="button"
									variant="outline"
									onClick={handleClose}
									disabled={seedMutation.isPending}
								>
									Cancel
								</Button>
								<GlowButton
									glowColor={glowColors.amber}
									type="submit"
									disabled={seedMutation.isPending}
									className="flex-1"
								>
									{seedMutation.isPending ? "Queuing..." : "Seed League"}
								</GlowButton>
							</div>
						</FieldGroup>
					</form>
				</div>
			</DialogContent>
		</Dialog>
	);
}
