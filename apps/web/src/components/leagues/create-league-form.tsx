import { Button } from "@/components/ui/button";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LogoUpload } from "@/components/ui/logo-upload";
import { authClient } from "@/lib/auth-client";
import { slugify } from "@/lib/slug";
import { useTRPC } from "@/lib/trpc";
import { useMutation, useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
	onSuccess?: (slug: string) => void;
}

export function CreateLeagueForm({
	onCancel,
	cancelLabel = "Cancel",
	onSuccess,
}: CreateLeagueFormProps) {
	const navigate = useNavigate();
	const [apiError, setApiError] = useState<string>("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
	const [logoPreview, setLogoPreview] = useState<string | null>(null);
	const [slugTouched, setSlugTouched] = useState(false);
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

	const handleFileSelect = (file: File) => {
		setSelectedLogo(file);
		const previewUrl = URL.createObjectURL(file);
		setLogoPreview(previewUrl);
	};

	const handleRemoveLogo = () => {
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

			if (onSuccess) {
				onSuccess(values.slug);
			} else {
				navigate({ to: "/leagues/$slug", params: { slug: values.slug } });
			}
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
		<form onSubmit={handleSubmit(onSubmit)}>
			<FieldGroup>
				<Field>
					<FieldLabel className="mb-2">League Logo (Optional)</FieldLabel>
					<LogoUpload
						previewUrl={logoPreview}
						fallback={
							<span className="text-2xl">{getInitials(logoPreview ? undefined : nameValue)}</span>
						}
						onFileSelect={handleFileSelect}
						onRemove={logoPreview ? handleRemoveLogo : undefined}
						disabled={isSubmitting}
						resizeOptions={{ maxWidth: 512, maxHeight: 512, quality: 0.8 }}
					/>
				</Field>

				<Field>
					<FieldLabel htmlFor="name">League Name</FieldLabel>
					<Input
						id="name"
						type="text"
						placeholder="My Awesome League"
						disabled={isSubmitting}
						data-testid="league-name-input"
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
						data-testid="league-slug-input"
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
						{isSlugTaken && <p className="text-sm text-destructive">This slug is already taken</p>}
					</div>
				</Field>

				{apiError && (
					<p className="text-sm text-destructive" data-testid="league-error">
						{apiError}
					</p>
				)}

				<div className="flex gap-4">
					{onCancel && (
						<Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
							{cancelLabel}
						</Button>
					)}
					<GlowButton
						glowColor={glowColors.blue}
						type="submit"
						disabled={!canSubmit}
						className="flex-1"
						data-testid="league-submit-button"
					>
						{isSubmitting ? "Creating..." : "Create League"}
					</GlowButton>
				</div>
			</FieldGroup>
		</form>
	);
}
