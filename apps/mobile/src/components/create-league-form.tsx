import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import { slugify } from "@/lib/slug";

const SLUG_REGEX = /^[a-z0-9-]+$/;

export function CreateLeagueForm({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [slugTouched, setSlugTouched] = useState(false);
	const [apiError, setApiError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSlugTaken, setIsSlugTaken] = useState(false);
	const [isCheckingSlug, setIsCheckingSlug] = useState(false);

	useEffect(() => {
		if (isOpen) {
			setName("");
			setSlug("");
			setSlugTouched(false);
			setApiError("");
			setIsSubmitting(false);
			setIsSlugTaken(false);
			setIsCheckingSlug(false);
		}
	}, [isOpen]);

	useEffect(() => {
		if (!slug) return;
		let active = true;
		const timer = setTimeout(async () => {
			if (!SLUG_REGEX.test(slug)) {
				setIsSlugTaken(false);
				setIsCheckingSlug(false);
				return;
			}
			setIsCheckingSlug(true);
			const { data, error } = await authClient.organization.checkSlug({ slug });
			if (!active) return;
			setIsSlugTaken(error ? error.code === "ORGANIZATION_SLUG_ALREADY_TAKEN" : !data?.status);
			setIsCheckingSlug(false);
		}, 500);
		return () => {
			active = false;
			clearTimeout(timer);
		};
	}, [slug]);

	const slugError = !slug
		? "Slug is required"
		: !SLUG_REGEX.test(slug)
			? "Slug must only contain lowercase letters, numbers, and hyphens"
			: isSlugTaken
				? "This slug is already taken"
				: undefined;

	const nameError = !name
		? "League name is required"
		: name.length > 100
			? "Name is too long"
			: undefined;
	const canSubmit =
		!isSubmitting &&
		!isCheckingSlug &&
		!isSlugTaken &&
		!!name &&
		name.length <= 100 &&
		!!slug &&
		SLUG_REGEX.test(slug);

	const onSubmit = async () => {
		setApiError("");
		setIsSubmitting(true);
		try {
			const { error } = await authClient.organization.create({ name, slug });
			if (error) {
				throw new Error(error.message || "Failed to create league");
			}
			await queryClient.invalidateQueries();
			await authClient.getSession();
			onClose();
		} catch (err) {
			setApiError(
				err instanceof Error ? err.message : "Failed to create league. Please try again."
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal visible={isOpen} animationType="slide" onRequestClose={onClose}>
			<ThemedView style={styles.container}>
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : undefined}
					style={styles.keyboardAvoid}
				>
					<View style={[styles.content, { paddingTop: insets.top + Spacing.four }]}>
						<ThemedText type="title" style={styles.title}>
							Create a New League
						</ThemedText>
						<ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
							Start tracking scores and competing with your friends
						</ThemedText>

						<View style={styles.form}>
							<Input
								label="League Name"
								placeholder="My Awesome League"
								value={name}
								onChangeText={(text) => {
									setName(text);
									setApiError("");
									if (!slugTouched && text) {
										setSlug(slugify(text));
									}
								}}
								editable={!isSubmitting}
								error={nameError}
							/>
							<Input
								label="League Slug"
								placeholder="my-awesome-league"
								value={slug}
								onChangeText={(text) => {
									setSlugTouched(true);
									setSlug(text);
									setApiError("");
								}}
								autoCapitalize="none"
								autoCorrect={false}
								editable={!isSubmitting}
								error={slugError}
							/>
							{apiError ? (
								<ThemedText type="small" style={{ color: theme.destructive }}>
									{apiError}
								</ThemedText>
							) : null}
						</View>

						<View style={styles.actions}>
							<Button variant="outline" fullWidth onPress={onClose} disabled={isSubmitting}>
								Cancel
							</Button>
							<Button fullWidth onPress={onSubmit} loading={isSubmitting} disabled={!canSubmit}>
								{isSubmitting ? "Creating..." : "Create League"}
							</Button>
						</View>
					</View>
				</KeyboardAvoidingView>
			</ThemedView>
		</Modal>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	keyboardAvoid: {
		flex: 1,
	},
	content: {
		flex: 1,
		paddingHorizontal: Spacing.four,
	},
	title: {
		marginTop: Spacing.two,
	},
	subtitle: {
		marginTop: Spacing.one,
	},
	form: {
		marginTop: Spacing.five,
		gap: Spacing.three,
	},
	actions: {
		marginTop: Spacing.five,
		gap: Spacing.three,
	},
});
