import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { slugify } from "@/lib/slug";
import { useTRPC } from "@/lib/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { Camera01Icon, Cancel01Icon } from "hugeicons-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

const createLeagueSchema = z.object({
	name: z.string().min(1, "League name is required").max(100, "Name is too long"),
	slug: z
		.string()
		.min(1, "Slug is required")
		.max(100, "Slug is too long")
		.regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens"),
});

type CreateLeagueFormValues = z.infer<typeof createLeagueSchema>;

interface CreateLeagueFormProps {
	onCancel?: () => void;
	cancelLabel?: string;
}

export function CreateLeagueForm({ onCancel, cancelLabel = "Cancel" }: CreateLeagueFormProps) {
	const navigate = useNavigate();
	const [apiError, setApiError] = useState<string>("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
	const [logoPreview, setLogoPreview] = useState<string | null>(null);
	const [slugTouched, setSlugTouched] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const trpc = useTRPC();

	const uploadLogoMutation = useMutation(trpc.organization.uploadLogo.mutationOptions());

	const {
		register,
		handleSubmit,
		watch,
		setValue,
		formState: { errors },
	} = useForm<CreateLeagueFormValues>({
		resolver: zodResolver(createLeagueSchema),
		defaultValues: {
			name: "",
			slug: "",
		},
	});

	const nameValue = watch("name");
	const slugValue = watch("slug");
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

	// Check slug availability with debounced value
	const { data: slugCheck, isLoading: isCheckingSlug } = useQuery({
		queryKey: ["checkSlug", debouncedSlug],
		queryFn: async () => {
			if (!debouncedSlug) return null;
			const { data, error } = await authClient.organization.checkSlug({ slug: debouncedSlug });
			// If slug is taken, return status false instead of throwing
			if (error?.code === "SLUG_IS_TAKEN") {
				return { status: false };
			}
			if (error) throw new Error(error.message);
			return data;
		},
		enabled: !!debouncedSlug && debouncedSlug.length > 0,
		staleTime: 0,
		gcTime: 0,
		refetchOnWindowFocus: false,
		retry: 0,
	});

	const isSlugTaken = slugCheck && !slugCheck.status;
	const canSubmit = !isSubmitting && !isCheckingSlug && !isSlugTaken;

	const resizeImage = (
		file: File,
		maxWidth: number,
		maxHeight: number,
		quality = 0.8
	): Promise<File> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				const img = new Image();
				img.onload = () => {
					const canvas = document.createElement("canvas");
					let width = img.width;
					let height = img.height;

					if (width > height) {
						if (width > maxWidth) {
							height = Math.round((height * maxWidth) / width);
							width = maxWidth;
						}
					} else {
						if (height > maxHeight) {
							width = Math.round((width * maxHeight) / height);
							height = maxHeight;
						}
					}

					canvas.width = width;
					canvas.height = height;

					const ctx = canvas.getContext("2d");
					if (!ctx) {
						reject(new Error("Failed to get canvas context"));
						return;
					}

					ctx.drawImage(img, 0, 0, width, height);

					canvas.toBlob(
						(blob) => {
							if (!blob) {
								reject(new Error("Failed to create blob"));
								return;
							}
							const resizedFile = new File([blob], file.name, {
								type: file.type,
								lastModified: Date.now(),
							});
							resolve(resizedFile);
						},
						file.type,
						quality
					);
				};
				img.onerror = reject;
				if (typeof e.target?.result === "string") {
					img.src = e.target.result;
				} else {
					reject(new Error("Failed to read file"));
				}
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	};

	const handleLogoClick = () => {
		fileInputRef.current?.click();
	};

	const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.item(0);
		if (!file) return;

		if (!file.type.startsWith("image/")) {
			toast.error("Please select an image file");
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			toast.error("Image size must be less than 5MB");
			return;
		}

		try {
			const resizedFile = await resizeImage(file, 512, 512, 0.8);

			if (resizedFile.size > 2 * 1024 * 1024) {
				toast.error("Image is too large after compression. Please try a smaller image.");
				return;
			}

			setSelectedLogo(resizedFile);
			const previewUrl = URL.createObjectURL(resizedFile);
			setLogoPreview(previewUrl);
		} catch {
			toast.error("Failed to process image");
		}

		event.target.value = "";
	};

	const handleRemoveLogo = (event: React.MouseEvent) => {
		event.stopPropagation();
		if (logoPreview) {
			URL.revokeObjectURL(logoPreview);
		}
		setSelectedLogo(null);
		setLogoPreview(null);
	};

	const onSubmit = async (values: CreateLeagueFormValues) => {
		setApiError("");
		setIsSubmitting(true);

		try {
			const result = await authClient.organization.create({
				name: values.name,
				slug: values.slug,
			});

			if (result.error) {
				throw new Error(result.error.message || "Failed to create league");
			}

			if (selectedLogo) {
				try {
					const imageData = await new Promise<string>((resolve, reject) => {
						const reader = new FileReader();
						reader.onload = () => {
							if (typeof reader.result === "string") {
								resolve(reader.result);
							} else {
								reject(new Error("Failed to read file as data URL"));
							}
						};
						reader.onerror = () => reject(new Error("Failed to read file"));
						reader.readAsDataURL(selectedLogo);
					});

					await uploadLogoMutation.mutateAsync({ imageData });
				} catch (logoErr) {
					console.error("Failed to upload logo:", logoErr);
					toast.error("League created but failed to upload logo");
				}
			}

			if (logoPreview) {
				URL.revokeObjectURL(logoPreview);
			}

			navigate({ to: "/leagues/$slug", params: { slug: values.slug } });
		} catch (err) {
			setApiError(
				err instanceof Error ? err.message : "Failed to create league. Please try again."
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleCancel = () => {
		if (logoPreview) {
			URL.revokeObjectURL(logoPreview);
		}
		onCancel?.();
	};

	const getInitials = (name?: string) => {
		if (!name) return "L";
		const words = name.trim().split(/\s+/).filter(Boolean);
		if (words.length === 0) return "L";
		if (words.length === 1) return words[0][0].toUpperCase();
		// Take first letter of first word and first letter of last word
		return (words[0][0] + words[words.length - 1][0]).toUpperCase();
	};

	return (
		<Card>
			<CardHeader className="pb-4 border-b border-border">
				<div className="flex items-center gap-3">
					<div className="w-2 h-6 bg-purple-500 rounded-full shadow-lg shadow-purple-500/25" />
					<CardTitle className="text-xl font-bold font-mono tracking-tight">
						Create a New League
					</CardTitle>
				</div>
				<CardDescription className="mt-2">
					Start tracking scores and competing with your friends
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit(onSubmit)}>
					<FieldGroup>
						<Field>
							<FieldLabel className="mb-2">League Logo (Optional)</FieldLabel>
							<div className="flex items-center gap-4">
								<button
									type="button"
									className="relative group cursor-pointer border-0 bg-transparent p-0"
									onClick={handleLogoClick}
								>
									<Avatar className="h-24 w-24 rounded-xl ring-2 ring-transparent group-hover:ring-primary transition-all pointer-events-none">
										<AvatarImage
											src={logoPreview || undefined}
											alt={"League logo"}
											className="rounded-xl"
										/>
										<AvatarFallback className="text-2xl rounded-xl bg-muted">
											{getInitials(logoPreview ? undefined : nameValue)}
										</AvatarFallback>
									</Avatar>
									<div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
										<Camera01Icon className="h-8 w-8 text-white" />
									</div>
									{logoPreview && (
										<button
											type="button"
											onClick={handleRemoveLogo}
											className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 bg-red-600 text-white border border-red-600 flex items-center justify-center transition-opacity pointer-events-auto z-10"
											aria-label="Remove logo"
										>
											<Cancel01Icon className="h-3 w-3" />
										</button>
									)}
									<input
										ref={fileInputRef}
										type="file"
										accept="image/*"
										onChange={handleLogoChange}
										className="hidden"
										disabled={isSubmitting}
									/>
								</button>
								<div className="flex flex-col gap-1">
									<p className="text-sm text-muted-foreground">Click to upload a logo</p>
									<p className="text-xs text-muted-foreground">Max 5MB. JPG, PNG, or WebP.</p>
								</div>
							</div>
						</Field>

						<Field>
							<FieldLabel htmlFor="name">League Name</FieldLabel>
							<Input
								id="name"
								type="text"
								placeholder="My Awesome League"
								disabled={isSubmitting}
								{...register("name")}
							/>
							{errors.name?.message && (
								<p className="text-sm text-destructive">{errors.name.message}</p>
							)}
						</Field>

						<Field>
							<FieldLabel htmlFor="slug">League Slug</FieldLabel>
							<Input
								id="slug"
								type="text"
								placeholder="my-awesome-league"
								disabled={isSubmitting}
								{...register("slug")}
								onChange={(e) => {
									setSlugTouched(true);
									register("slug").onChange(e);
								}}
							/>
							{errors.slug?.message && (
								<p className="text-sm text-destructive">{errors.slug.message}</p>
							)}
							<div className="min-h-5">
								{isSlugTaken && (
									<p className="text-sm text-destructive">This slug is already taken</p>
								)}
							</div>
						</Field>

						{apiError && <p className="text-sm text-destructive">{apiError}</p>}

						<div className="flex gap-4">
							{onCancel && (
								<Button
									type="button"
									variant="outline"
									onClick={handleCancel}
									disabled={isSubmitting}
								>
									{cancelLabel}
								</Button>
							)}
							<Button type="submit" disabled={!canSubmit} className="flex-1">
								{isSubmitting ? "Creating..." : "Create League"}
							</Button>
						</div>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
