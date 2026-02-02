import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const createLeagueSchema = z.object({
	name: z.string().min(1, "League name is required").max(100, "Name is too long"),
});

type CreateLeagueFormValues = z.infer<typeof createLeagueSchema>;

export const Route = createFileRoute("/_authenticated/onboarding/create-league")({
	component: CreateLeaguePage,
});

function CreateLeaguePage() {
	const navigate = useNavigate();
	const [apiError, setApiError] = useState<string>("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<CreateLeagueFormValues>({
		resolver: zodResolver(createLeagueSchema),
		defaultValues: {
			name: "",
		},
	});

	const onSubmit = async (values: CreateLeagueFormValues) => {
		setApiError("");
		setIsSubmitting(true);
		try {
			// Generate slug from name
			const slug = values.name
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, "");

			const result = await authClient.organization.create({
				name: values.name,
				slug,
			});

			if (result.error) {
				throw new Error(result.error.message || "Failed to create league");
			}

			navigate({ to: "/leagues/$slug", params: { slug } });
		} catch (err) {
			setApiError(
				err instanceof Error ? err.message : "Failed to create league. Please try again."
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleCancel = () => {
		// Go back to onboarding welcome page
		navigate({ to: "/onboarding" });
	};

	return (
		<>
			<div className="flex min-h-screen items-center justify-center p-4">
				<div className="w-full max-w-2xl">
					<Card>
						<CardHeader>
							<CardTitle className="text-2xl">Create a New League</CardTitle>
							<CardDescription>
								Start tracking scores and competing with your friends
							</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={handleSubmit(onSubmit)}>
								<FieldGroup>
									<Field>
										<FieldLabel htmlFor="name">League Name</FieldLabel>
										<Input
											id="name"
											type="text"
											placeholder="My Awesome League"
											disabled={isSubmitting}
											{...register("name")}
										/>
										{errors.name && (
											<p className="text-sm text-destructive">{errors.name.message}</p>
										)}
									</Field>
									{apiError && <p className="text-sm text-destructive">{apiError}</p>}
									<div className="flex gap-4">
										<Button
											type="button"
											variant="outline"
											onClick={handleCancel}
											disabled={isSubmitting}
										>
											Cancel
										</Button>
										<Button type="submit" disabled={isSubmitting} className="flex-1">
											{isSubmitting ? "Creating..." : "Create League"}
										</Button>
									</div>
								</FieldGroup>
							</form>
						</CardContent>
					</Card>
				</div>
			</div>
		</>
	);
}
