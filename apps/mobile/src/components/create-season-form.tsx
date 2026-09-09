import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScoreTypeCard, SCORE_TYPES } from "@/components/score-type-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { slugify } from "@/lib/slug";
import { trpcClient } from "@/lib/trpc";

const SLUG_REGEX = /^[a-z0-9-]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function toDateInput(date: Date) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

function parseDate(value: string) {
	const [y, m, d] = value.split("-").map(Number);
	return new Date(y, m - 1, d);
}

export function CreateSeasonForm({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [slugTouched, setSlugTouched] = useState(false);
	const [scoreType, setScoreType] = useState<(typeof SCORE_TYPES)[number]>("elo");
	const [startDate, setStartDate] = useState(() => toDateInput(new Date()));
	const [endDate, setEndDate] = useState("");
	const [initialScore, setInitialScore] = useState("1200");
	const [kFactor, setKFactor] = useState("32");
	const [rounds, setRounds] = useState("1");
	const [submitted, setSubmitted] = useState(false);
	const [apiError, setApiError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSlugTaken, setIsSlugTaken] = useState(false);
	const [isCheckingSlug, setIsCheckingSlug] = useState(false);
	const [openDateField, setOpenDateField] = useState<"start" | "end" | null>(null);
	const scrollRef = useRef<ScrollView>(null);
	const startDateRef = useRef<View>(null);
	const endDateRef = useRef<View>(null);

	useEffect(() => {
		if (!openDateField || Platform.OS !== "ios") return;
		const fieldRef = openDateField === "start" ? startDateRef : endDateRef;
		const timer = setTimeout(() => {
			const field = fieldRef.current;
			const scroll = scrollRef.current;
			if (!field || !scroll) return;
			field.measureLayout(
				scroll.getInnerViewNode(),
				(_, y) => {
					scroll.scrollTo({ y: Math.max(0, y - Spacing.two), animated: true });
				},
				() => {}
			);
		}, 0);
		return () => clearTimeout(timer);
	}, [openDateField]);

	useEffect(() => {
		if (isOpen) {
			setName("");
			setSlug("");
			setSlugTouched(false);
			setScoreType("elo");
			setStartDate(toDateInput(new Date()));
			setEndDate("");
			setInitialScore("1200");
			setKFactor("32");
			setRounds("1");
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

	const isElo = scoreType === "elo" || scoreType === "1-v-n-elo";

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
	const startDateError = !submitted
		? undefined
		: !DATE_REGEX.test(startDate)
			? "Start date must be YYYY-MM-DD"
			: undefined;
	const endDateError =
		!submitted || !endDate
			? undefined
			: !DATE_REGEX.test(endDate)
				? "End date must be YYYY-MM-DD"
				: endDate < startDate
					? "End date must be after start date"
					: undefined;

	const isValidInt = (value: string) => /^\d+$/.test(value) && Number(value) >= 0;
	const initialScoreError =
		isElo && submitted && !isValidInt(initialScore)
			? "Initial score must be a non-negative whole number"
			: undefined;
	const kFactorError =
		isElo && submitted && !isValidInt(kFactor)
			? "K-factor must be a non-negative whole number"
			: undefined;
	const roundsError =
		!isElo && submitted && (!isValidInt(rounds) || Number(rounds) < 1)
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
		DATE_REGEX.test(startDate) &&
		(!endDate || (DATE_REGEX.test(endDate) && endDate >= startDate)) &&
		(!isElo || (isValidInt(initialScore) && isValidInt(kFactor))) &&
		(isElo || (isValidInt(rounds) && Number(rounds) >= 1));

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
				initialScore: isElo ? Number(initialScore) : 0,
				kFactor: isElo ? Number(kFactor) : 0,
				startDate: parseDate(startDate),
				...(endDate ? { endDate: parseDate(endDate) } : {}),
				...(!isElo ? { rounds: Number(rounds) } : {}),
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
					<View style={[styles.content, { paddingTop: insets.top + Spacing.three }]}>
						<View style={styles.headerRow}>
							<ThemedText type="subtitle" style={styles.title}>
								Create Season
							</ThemedText>
							<ModalCloseButton onPress={onClose} />
						</View>

						<ScrollView
							ref={scrollRef}
							style={styles.scroll}
							contentContainerStyle={styles.form}
							keyboardShouldPersistTaps="handled"
						>
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
							<View style={styles.scoreCards}>
								{SCORE_TYPES.map((type) => (
									<ScoreTypeCard
										key={type}
										type={type}
										selected={scoreType === type}
										onPress={() => setScoreType(type)}
										disabled={isSubmitting}
									/>
								))}
							</View>
							<DateField
								label="Start Date"
								value={startDate}
								onChange={setStartDate}
								editable={!isSubmitting}
								error={startDateError}
								open={openDateField === "start"}
								onOpenChange={(open) => setOpenDateField(open ? "start" : null)}
								containerRef={startDateRef}
							/>
							<DateField
								label="End Date (optional)"
								value={endDate}
								onChange={setEndDate}
								editable={!isSubmitting}
								error={endDateError}
								minimumDate={startDate ? parseDate(startDate) : undefined}
								open={openDateField === "end"}
								onOpenChange={(open) => setOpenDateField(open ? "end" : null)}
								containerRef={endDateRef}
							/>
							{isElo ? (
								<>
									<Input
										label="Initial ELO"
										value={initialScore}
										onChangeText={setInitialScore}
										keyboardType="numeric"
										editable={!isSubmitting}
										error={initialScoreError}
									/>
									<Input
										label="K-Factor"
										value={kFactor}
										onChangeText={setKFactor}
										keyboardType="numeric"
										editable={!isSubmitting}
										error={kFactorError}
									/>
								</>
							) : (
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
						</ScrollView>

						<View style={[styles.actions, { paddingBottom: insets.bottom + Spacing.two }]}>
							<Button
								fullWidth
								variant="glow"
								onPress={onSubmit}
								loading={isSubmitting}
								disabled={!canSubmit}
							>
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
		fontSize: 24,
		lineHeight: 32,
		fontWeight: "700",
		marginBottom: Spacing.four,
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	scroll: {
		flex: 1,
	},
	form: {
		gap: Spacing.three,
		paddingBottom: Spacing.four,
	},
	scoreCards: {
		gap: Spacing.two,
	},
	actions: {
		paddingTop: Spacing.three,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: "rgba(128,128,128,0.3)",
	},
});
