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
import { slugify } from "@/lib/slug";
import { trpcClient } from "@/lib/trpc";

const SLUG_REGEX = /^[a-z0-9-]+$/;
const SCORE_TYPES = ["elo", "3-1-0", "1-v-n-elo"] as const;

export function CreateSeasonForm({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [slugTouched, setSlugTouched] = useState(false);
	const [scoreType, setScoreType] = useState<(typeof SCORE_TYPES)[number]>("elo");
	const [initialScore, setInitialScore] = useState("1000");
	const [kFactor, setKFactor] = useState("32");
	const [rounds, setRounds] = useState("10");
	const [submitted, setSubmitted] = useState(false);
	const [apiError, setApiError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSlugTaken, setIsSlugTaken] = useState(false);
	const [isCheckingSlug, setIsCheckingSlug] = useState(false);

	useEffect(() => {
		if (isOpen) {
			setName("");
			setSlug("");
			setSlugTouched(false);
			setScoreType("elo");
			setInitialScore("1000");
			setKFactor("32");
			setRounds("10");
			setSubmitted(false);
			setApiError("");
			setIsSubmitting(false);
			setIsSlugTaken(false);
			setIsCheckingSlug(false);
		}
	}, [isOpen]);

	useEffect(() => {
		if (!slugTouched && name) {
			setSlug(slugify(name));
		} else if (!slugTouched && !name) {
			setSlug("");
		}
	}, [name, slugTouched]);

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
			try {
				const { available } = await trpcClient.season.checkSlugAvailability.query({ slug });
				if (!active) return;
				setIsSlugTaken(!available);
			} catch {
				if (active) setIsSlugTaken(false);
			} finally {
				if (active) setIsCheckingSlug(false);
			}
		}, 500);
		return () => {
			active = false;
			clearTimeout(timer);
		};
	}, [slug]);

	const slugError = !submitted
		? undefined
		: !slug
			? "Slug is required"
			: !SLUG_REGEX.test(slug)
				? "Slug must only contain lowercase letters, numbers, and hyphens"
				: isSlugTaken
					? "This slug is already taken"
					: undefined;
	const nameError = !submitted
		? undefined
		: !name
			? "Season name is required"
			: name.length > 100
				? "Name is too long"
				: undefined;

	const isThreeOneZero = scoreType === "3-1-0";
	const isValidInt = (value: string) => /^\d+$/.test(value) && Number(value) >= 0;
	const initialScoreError =
		!submitted || !isValidInt(initialScore)
			? "Initial score must be a non-negative whole number"
			: undefined;
	const kFactorError =
		!submitted || !isValidInt(kFactor) ? "K-factor must be a non-negative whole number" : undefined;
	const roundsError =
		isThreeOneZero && submitted && (!isValidInt(rounds) || Number(rounds) < 1)
			? "Rounds must be at least 1"
			: undefined;
	const canSubmit =
		!isSubmitting &&
		!isCheckingSlug &&
		!isSlugTaken &&
		!!name &&
		name.length <= 100 &&
		!!slug &&
		SLUG_REGEX.test(slug) &&
		isValidInt(initialScore) &&
		isValidInt(kFactor) &&
		(!isThreeOneZero || (isValidInt(rounds) && Number(rounds) >= 1));

	const onSubmit = async () => {
		if (isSubmitting) return;
		setSubmitted(true);
		setApiError("");
		setIsSubmitting(true);
		try {
			await trpcClient.season.create.mutate({
				name,
				slug,
				scoreType,
				initialScore: Number(initialScore),
				kFactor: Number(kFactor),
				startDate: new Date(),
				...(isThreeOneZero ? { rounds: Number(rounds) } : {}),
			});
			await queryClient.invalidateQueries({ queryKey: ["season"] });
			onClose();
		} catch (err) {
			setApiError(
				err instanceof Error ? err.message : "Failed to create season. Please try again."
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
							Create a New Season
						</ThemedText>
						<ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
							Set up a season for {scoreType} scoring
						</ThemedText>

						<View style={styles.form}>
							<Input
								label="Season Name"
								placeholder="Season 1"
								value={name}
								onChangeText={(text) => {
									setName(text);
									setApiError("");
								}}
								editable={!isSubmitting}
								error={nameError}
							/>
							<Input
								label="Season Slug"
								placeholder="season-1"
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
							<View style={styles.segmentRow}>
								{SCORE_TYPES.map((type) => {
									const selected = scoreType === type;
									return (
										<Button
											key={type}
											variant={selected ? "primary" : "outline"}
											style={styles.segment}
											onPress={() => setScoreType(type)}
											disabled={isSubmitting}
										>
											{type}
										</Button>
									);
								})}
							</View>
							<View style={styles.row}>
								<Input
									label="Initial Score"
									value={initialScore}
									onChangeText={setInitialScore}
									keyboardType="numeric"
									editable={!isSubmitting}
									error={initialScoreError}
									style={styles.half}
								/>
								<Input
									label="K-Factor"
									value={kFactor}
									onChangeText={setKFactor}
									keyboardType="numeric"
									editable={!isSubmitting}
									error={kFactorError}
									style={styles.half}
								/>
							</View>
							{isThreeOneZero && (
								<Input
									label="Rounds"
									value={rounds}
									onChangeText={setRounds}
									keyboardType="numeric"
									editable={!isSubmitting}
									error={roundsError}
								/>
							)}
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
								{isSubmitting ? "Creating..." : "Create Season"}
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
	segmentRow: {
		flexDirection: "row",
		gap: Spacing.two,
	},
	segment: {
		flex: 1,
	},
	row: {
		flexDirection: "row",
		gap: Spacing.two,
	},
	half: {
		flex: 1,
	},
	actions: {
		marginTop: Spacing.five,
		gap: Spacing.three,
	},
});
