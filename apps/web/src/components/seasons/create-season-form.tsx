import { Button } from "@/components/ui/button";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTRPC, trpcClient } from "@/lib/trpc";
import { queryClient } from "@/lib/query-client";
import { slugify } from "@/lib/slug";
import {
	Award01Icon,
	Calendar01Icon,
	Cancel01Icon,
	Target01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

const scoreTypes = ["elo", "3-1-0"] as const;

const createSeasonSchema = z
	.object({
		scoreType: z.enum(scoreTypes),
		name: z.string().min(1, "Season name is required").max(100, "Name is too long"),
		slug: z
			.string()
			.min(1, "Slug is required")
			.max(100, "Slug is too long")
			.regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens"),
		startDate: z.date({ required_error: "Start date is required" }),
		endDate: z.date().optional(),
		rounds: z.number().int().min(1, "Rounds must be at least 1"),
		initialScore: z.number().int().min(0, "Initial score must be at least 0"),
		kFactor: z.number().int().min(1, "K-factor must be at least 1"),
	})
	.refine(
		(data) => {
			if (data.endDate && data.startDate > data.endDate) {
				return false;
			}
			return true;
		},
		{
			message: "End date must be after start date",
			path: ["endDate"],
		}
	);

type CreateSeasonFormValues = z.infer<typeof createSeasonSchema>;

interface CreateSeasonFormProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess?: (slug: string) => void;
}

const scoreTypeConfig = {
	elo: {
		label: "ELO Rating",
		icon: Award01Icon,
		color: "emerald",
		description: "Dynamic skill-based rating system",
	},
	"3-1-0": {
		label: "Points System",
		icon: Target01Icon,
		color: "blue",
		description: "Win 3pts • Draw 1pt • Loss 0pts",
	},
};

export function CreateSeasonForm({ isOpen, onClose, onSuccess }: CreateSeasonFormProps) {
	const trpc = useTRPC();
	const [apiError, setApiError] = useState<string>("");
	const [startDateOpen, setStartDateOpen] = useState(false);
	const [endDateOpen, setEndDateOpen] = useState(false);
	const [slugTouched, setSlugTouched] = useState(false);

	const createMutation = useMutation({
		...trpc.season.create.mutationOptions(),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["seasons"] });
		},
	});

	const {
		register,
		handleSubmit,
		watch,
		setValue,
		formState: { errors },
		reset,
	} = useForm<CreateSeasonFormValues>({
		resolver: zodResolver(createSeasonSchema),
		defaultValues: {
			scoreType: "elo",
			name: "",
			slug: "",
			initialScore: 1200,
			kFactor: 32,
			rounds: 1,
		},
	});

	const scoreType = watch("scoreType");
	const startDate = watch("startDate");
	const endDate = watch("endDate");
	const nameValue = watch("name");
	const slugValue = watch("slug");
	const isElo = scoreType === "elo";

	const [debouncedSlug, setDebouncedSlug] = useState(slugValue);

	// Auto-slugify name when it changes, unless user has manually edited slug
	useEffect(() => {
		if (!slugTouched && nameValue) {
			setValue("slug", slugify(nameValue));
		}
	}, [nameValue, slugTouched, setValue]);

	// Debounce slug value for validation
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSlug(slugValue);
		}, 500);
		return () => clearTimeout(timer);
	}, [slugValue]);

	// Check slug availability using dedicated endpoint
	const { data: slugCheck } = useQuery({
		queryKey: ["season-slug-check", debouncedSlug],
		queryFn: async () => {
			if (!debouncedSlug) return { available: true };
			return await trpcClient.season.checkSlugAvailability.query({ slug: debouncedSlug });
		},
		enabled: !!debouncedSlug,
	});

	const isSlugTaken = slugCheck ? !slugCheck.available : false;
	const canSubmit = !createMutation.isPending && !isSlugTaken;

	// Set default rounds value when switching to Points System
	useEffect(() => {
		if (!isElo) {
			const currentRounds = watch("rounds");
			// Only set default if field is empty/undefined
			if (!currentRounds) {
				setValue("rounds", 1);
			}
		}
	}, [isElo, setValue, watch]);

	const onSubmit = async (values: CreateSeasonFormValues) => {
		setApiError("");

		try {
			const input = {
				name: values.name,
				slug: values.slug,
				startDate: values.startDate,
				endDate: values.endDate,
				rounds: !isElo ? values.rounds : undefined,
				scoreType: values.scoreType,
				initialScore: isElo ? values.initialScore : 0,
				kFactor: isElo ? values.kFactor : 0,
			};

			const result = await createMutation.mutateAsync(input);

			toast.success("Season created successfully");
			onSuccess?.(result.slug);
			reset();
			onClose();
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to create season";
			setApiError(message);
			toast.error(message);
		}
	};

	const handleCancel = () => {
		reset();
		setApiError("");
		setSlugTouched(false);
		onClose();
	};

	const handleStartDateSelect = (date: Date | undefined) => {
		if (date) {
			setValue("startDate", date);
			setStartDateOpen(false);
		}
	};

	const handleEndDateSelect = (date: Date | undefined) => {
		if (date) {
			setValue("endDate", date);
			setEndDateOpen(false);
		}
	};

	const clearEndDate = (e: React.MouseEvent) => {
		e.stopPropagation();
		setValue("endDate", undefined);
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
			<DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-hidden">
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
						<div className="w-2 h-6 bg-purple-500 rounded-full shadow-lg shadow-purple-500/25" />
						<DialogTitle className="text-xl font-bold font-mono tracking-tight">
							Create Season
						</DialogTitle>
					</div>
				</DialogHeader>

				<div className="relative z-10 overflow-y-auto max-h-[calc(95vh-140px)]">
					<form onSubmit={handleSubmit(onSubmit)} className="space-y-2 p-1">
						{/* Scoring System Selection */}
						<div className="grid grid-cols-2 gap-2">
							{scoreTypes.map((type) => {
								const config = scoreTypeConfig[type];
								const isSelected = scoreType === type;

								// Define explicit classes to ensure Tailwind generates them
								const selectedClasses = {
									elo: "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/20",
									"3-1-0": "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20",
								};

								const iconClasses = {
									elo: "bg-emerald-500/20",
									"3-1-0": "bg-blue-500/20",
								};

								const iconColorClasses = {
									elo: "text-emerald-400",
									"3-1-0": "text-blue-400",
								};

								const textColorClasses = {
									elo: "text-emerald-300 dark:text-emerald-300",
									"3-1-0": "text-blue-300 dark:text-blue-300",
								};

								const topBorderClasses = {
									elo: "from-emerald-400 to-emerald-600",
									"3-1-0": "from-blue-400 to-blue-600",
								};

								return (
									<button
										key={type}
										type="button"
										onClick={() => setValue("scoreType", type)}
										className={`
                        relative overflow-hidden rounded-lg p-3 border-2 transition-all duration-300
                        ${
													isSelected
														? selectedClasses[type]
														: "border-border bg-card/50 hover:border-border/80 hover:bg-card/80"
												}
                      `}
									>
										{/* Selection Indicator */}
										{isSelected && (
											<div
												className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${topBorderClasses[type]}`}
											/>
										)}

										<div className="flex flex-col items-center space-y-2 text-center">
											<div
												className={`w-6 h-6 rounded-lg ${iconClasses[type]} flex items-center justify-center`}
											>
												<HugeiconsIcon
													icon={config.icon}
													className={`w-4 h-4 ${iconColorClasses[type]}`}
												/>
											</div>

											<div>
												<div
													className={`font-mono text-xs font-bold ${
														isSelected ? textColorClasses[type] : "text-foreground"
													}`}
												>
													{config.label}
												</div>
												<div className="text-xs text-muted-foreground leading-tight">
													{config.description}
												</div>
											</div>
										</div>
									</button>
								);
							})}
						</div>

						<FieldGroup className="space-y-2">
							{/* Season Name */}
							<Field>
								<FieldLabel className="font-mono text-xs font-medium tracking-wide mb-0.5">
									Name
								</FieldLabel>
								<Input
									{...register("name")}
									className="h-8 font-mono focus:border-purple-500 focus:ring-purple-500/20 text-sm"
									placeholder="Spring 2025"
								/>
								{errors.name?.message && (
									<p className="text-destructive text-xs font-mono mt-0.5">{errors.name.message}</p>
								)}
							</Field>

							{/* Season Slug */}
							<Field>
								<FieldLabel className="font-mono text-xs font-medium tracking-wide mb-0.5">
									Slug
								</FieldLabel>
								<Input
									{...register("slug")}
									className="h-8 font-mono focus:border-purple-500 focus:ring-purple-500/20 text-sm"
									placeholder="spring-2025"
									onChange={(e) => {
										setSlugTouched(true);
										register("slug").onChange(e);
									}}
								/>
								{errors.slug?.message && (
									<p className="text-destructive text-xs font-mono mt-0.5">{errors.slug.message}</p>
								)}
								{isSlugTaken && (
									<p className="text-destructive text-xs font-mono mt-0.5">
										This slug is already taken
									</p>
								)}
								{isSlugTaken && (
									<p className="text-red-400 text-xs font-mono mt-0.5">
										This slug is already taken
									</p>
								)}
							</Field>

							{/* Date Selection */}
							<div className="grid grid-cols-2 gap-3">
								<Field>
									<FieldLabel className="font-mono text-xs font-medium tracking-wide mb-0.5">
										Start Date
									</FieldLabel>
									<Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
										<PopoverTrigger>
											<Button
												variant="outline"
												className="w-full justify-start font-mono h-8 text-sm"
											>
												<HugeiconsIcon icon={Calendar01Icon} className="mr-2 h-3 w-3" />
												{startDate ? (
													format(startDate, "yyyy.MM.dd")
												) : (
													<span className="text-muted-foreground">Select date</span>
												)}
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0">
											<Calendar
												mode="single"
												selected={startDate}
												onSelect={handleStartDateSelect}
												initialFocus
											/>
										</PopoverContent>
									</Popover>
									{errors.startDate?.message && (
										<p className="text-destructive text-xs font-mono mt-0.5">
											{errors.startDate.message}
										</p>
									)}
								</Field>

								<Field>
									<FieldLabel className="font-mono text-xs font-medium tracking-wide mb-0.5">
										End Date <span className="text-muted-foreground">(optional)</span>
									</FieldLabel>
									<Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
										<PopoverTrigger>
											<Button
												variant="outline"
												className="w-full justify-start font-mono relative h-8 text-sm"
											>
												<HugeiconsIcon icon={Calendar01Icon} className="mr-2 h-3 w-3" />
												{endDate ? (
													format(endDate, "yyyy.MM.dd")
												) : (
													<span className="text-muted-foreground">Select date</span>
												)}
												{endDate && (
													<button
														type="button"
														onClick={clearEndDate}
														className="absolute right-2 text-muted-foreground hover:text-foreground"
													>
														<HugeiconsIcon icon={Cancel01Icon} className="h-3 w-3" />
													</button>
												)}
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-auto p-0">
											<Calendar
												mode="single"
												selected={endDate}
												onSelect={handleEndDateSelect}
												initialFocus
												disabled={(date) => (startDate ? date < startDate : false)}
											/>
										</PopoverContent>
									</Popover>
									{errors.endDate?.message && (
										<p className="text-destructive text-xs font-mono mt-0.5">
											{errors.endDate.message}
										</p>
									)}
								</Field>
							</div>

							{/* ELO Configuration */}
							{isElo && (
								<div className="grid grid-cols-2 gap-3">
									<Field>
										<FieldLabel className="font-mono text-xs font-medium tracking-wide mb-0.5">
											Initial ELO Rating
										</FieldLabel>
										<Input
											{...register("initialScore", { valueAsNumber: true })}
											type="number"
											className="h-8 font-mono focus:border-amber-500 focus:ring-amber-500/20 text-sm"
										/>
										{errors.initialScore?.message && (
											<p className="text-destructive text-xs font-mono mt-0.5">
												{errors.initialScore.message}
											</p>
										)}
									</Field>

									<Field>
										<FieldLabel className="font-mono text-xs font-medium tracking-wide mb-0.5">
											K-Factor
										</FieldLabel>
										<Input
											{...register("kFactor", { valueAsNumber: true })}
											type="number"
											className="h-8 font-mono focus:border-amber-500 focus:ring-amber-500/20 text-sm"
										/>
										{errors.kFactor?.message && (
											<p className="text-destructive text-xs font-mono mt-0.5">
												{errors.kFactor.message}
											</p>
										)}
									</Field>
								</div>
							)}

							{/* Rounds - only for 3-1-0 scoring */}
							{!isElo && (
								<Field>
									<FieldLabel className="font-mono text-xs font-medium tracking-wide mb-0.5">
										Rounds
									</FieldLabel>
									<Input
										{...register("rounds", { valueAsNumber: true })}
										type="number"
										placeholder="1"
										className="h-8 font-mono focus:border-blue-500 focus:ring-blue-500/20 text-sm"
									/>
									{errors.rounds?.message && (
										<p className="text-destructive text-xs font-mono mt-0.5">
											{errors.rounds.message}
										</p>
									)}
								</Field>
							)}
						</FieldGroup>

						{/* Error Display */}
						{apiError && (
							<div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
								<p className="text-destructive font-mono text-xs">{apiError}</p>
							</div>
						)}

						{/* Action Buttons */}
						<div className="flex gap-4 pt-2">
							<Button
								type="button"
								variant="outline"
								onClick={handleCancel}
								className="font-mono h-8 text-sm"
							>
								Cancel
							</Button>
							<GlowButton
								type="submit"
								glowColor={glowColors.blue}
								disabled={!canSubmit}
								className="flex-1 font-mono h-8 text-sm"
							>
								{createMutation.isPending ? "Creating..." : "Create Season"}
							</GlowButton>
						</div>
					</form>
				</div>
			</DialogContent>
		</Dialog>
	);
}
