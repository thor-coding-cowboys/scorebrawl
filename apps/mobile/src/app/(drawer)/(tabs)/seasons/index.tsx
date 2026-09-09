import { SymbolView } from "expo-symbols";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
	Alert,
	FlatList,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import { formatDate, getSeasonStatus } from "@/lib/collections/season";
import { trpcClient, useTRPC, type RouterOutput } from "@/lib/trpc";

function StatusPill({
	status,
}: {
	status: "active" | "upcoming" | "ended" | "locked" | "archived";
}) {
	const config: Record<string, { color: string; icon: Parameters<typeof SymbolView>[0]["name"] }> =
		{
			active: {
				color: "#16a34a",
				icon: { ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" },
			},
			upcoming: {
				color: "#2563eb",
				icon: { ios: "clock.fill", android: "schedule", web: "schedule" },
			},
			ended: { color: "#d97706", icon: { ios: "flag.fill", android: "flag", web: "flag" } },
			locked: { color: "#6b7280", icon: { ios: "lock.fill", android: "lock", web: "lock" } },
			archived: {
				color: "#9ca3af",
				icon: { ios: "archivebox.fill", android: "archive", web: "archive" },
			},
		};
	const { color, icon } = config[status] ?? config.ended;
	return (
		<View style={[styles.pill, { backgroundColor: `${color}1a`, borderColor: `${color}40` }]}>
			<SymbolView name={icon} size={12} tintColor={color} />
			<ThemedText type="small" style={{ color, fontSize: 11 }}>
				{status.charAt(0).toUpperCase() + status.slice(1)}
			</ThemedText>
		</View>
	);
}

function toDateInput(date: Date) {
	const d = new Date(date);
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function parseDate(value: string) {
	const [y, m, d] = value.split("-").map(Number);
	return new Date(y, m - 1, d);
}

type SeasonListItem = RouterOutput["season"]["getAll"][number];

function EditSeasonModal({
	season,
	isOpen,
	onClose,
}: {
	season: SeasonListItem | null;
	isOpen: boolean;
	onClose: () => void;
}) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const [apiError, setApiError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (isOpen && season) {
			setName(season.name);
			setSlug(season.slug);
			setStartDate(toDateInput(new Date(season.startDate)));
			setEndDate(season.endDate ? toDateInput(new Date(season.endDate)) : "");
			setSubmitted(false);
			setApiError("");
			setIsSubmitting(false);
		}
	}, [isOpen, season]);

	const nameError = !submitted
		? undefined
		: !name.trim()
			? "Season name is required"
			: name.trim().length > 100
				? "Name is too long"
				: undefined;
	const slugError = !submitted
		? undefined
		: !/^[a-z0-9-]+$/.test(slug)
			? "Slug must only contain lowercase letters, numbers, and hyphens"
			: undefined;
	const startDateError =
		!submitted || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)
			? "Start date must be YYYY-MM-DD"
			: undefined;
	const endDateError =
		!submitted || !endDate
			? undefined
			: !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
				? "End date must be YYYY-MM-DD"
				: endDate < startDate
					? "End date must be after start date"
					: undefined;

	const canSubmit =
		!isSubmitting &&
		!!name.trim() &&
		name.trim().length <= 100 &&
		/^[a-z0-9-]+$/.test(slug) &&
		/^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
		(!endDate || (/^\d{4}-\d{2}-\d{2}$/.test(endDate) && endDate >= startDate));

	const onSubmit = async () => {
		if (!season || isSubmitting) return;
		setSubmitted(true);
		setApiError("");
		setIsSubmitting(true);
		try {
			await trpcClient.season.edit.mutate({
				seasonSlug: season.slug,
				name: name.trim(),
				slug,
				startDate: parseDate(startDate),
				...(endDate ? { endDate: parseDate(endDate) } : {}),
			});
			await queryClient.invalidateQueries({ queryKey: ["season"] });
			onClose();
		} catch (err) {
			setApiError(err instanceof Error ? err.message : "Failed to save season.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal visible={isOpen} animationType="slide" onRequestClose={onClose}>
			<ThemedView style={styles.modalContainer}>
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : undefined}
					style={styles.keyboardAvoid}
				>
					<View style={[styles.content, { paddingTop: insets.top + Spacing.three }]}>
						<View style={styles.modalHeader}>
							<ThemedText type="subtitle" style={styles.modalTitle}>
								Edit Season
							</ThemedText>
							<ModalCloseButton onPress={onClose} />
						</View>

						<ScrollView
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
									setSlug(text);
									setApiError("");
								}}
								autoCapitalize="none"
								autoCorrect={false}
								editable={!isSubmitting}
								error={slugError}
							/>
							<Input
								label="Start Date"
								placeholder="YYYY-MM-DD"
								value={startDate}
								onChangeText={setStartDate}
								autoCapitalize="none"
								autoCorrect={false}
								editable={!isSubmitting}
								error={startDateError}
							/>
							<Input
								label="End Date (optional)"
								placeholder="YYYY-MM-DD"
								value={endDate}
								onChangeText={setEndDate}
								autoCapitalize="none"
								autoCorrect={false}
								editable={!isSubmitting}
								error={endDateError}
							/>
							{apiError ? (
								<ThemedText type="small" style={{ color: theme.destructive }}>
									{apiError}
								</ThemedText>
							) : null}
						</ScrollView>

						<View style={[styles.modalActions, { paddingBottom: insets.bottom + Spacing.two }]}>
							<Button
								fullWidth
								variant="glow"
								onPress={onSubmit}
								loading={isSubmitting}
								disabled={!canSubmit}
							>
								{isSubmitting ? "Saving..." : "Save Changes"}
							</Button>
						</View>
					</View>
				</KeyboardAvoidingView>
			</ThemedView>
		</Modal>
	);
}

export default function SeasonsScreen() {
	const trpc = useTRPC();
	const screenRouter = useRouter();
	const queryClient = useQueryClient();
	const [editingSeason, setEditingSeason] = useState<SeasonListItem | null>(null);
	const { data: activeMember } = authClient.useActiveMember();
	const role = activeMember?.role;
	const isEditor = role === "owner" || role === "editor";
	const {
		data: seasons = [],
		isLoading,
		isError,
		refetch,
	} = useQuery(trpc.season.getAll.queryOptions());

	const handlePress = (slug: string) => {
		if (!slug) {
			console.warn("Season slug is missing");
			return;
		}
		screenRouter.navigate(`/seasons/${slug}`);
	};

	const confirmToggleLock = (item: SeasonListItem) => {
		Alert.alert(
			item.closed ? "Unlock season" : "Lock season",
			item.closed
				? `Unlock "${item.name}" so new matches can be created again?`
				: `Lock "${item.name}" so no more matches can be created?`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: item.closed ? "Unlock" : "Lock",
					style: item.closed ? undefined : "destructive",
					onPress: () => handleToggleLock(item),
				},
			]
		);
	};

	const handleToggleLock = async (item: SeasonListItem) => {
		try {
			await trpcClient.season.updateClosedStatus.mutate({
				seasonSlug: item.slug,
				closed: !item.closed,
			});
			await queryClient.invalidateQueries({ queryKey: ["season"] });
		} catch (err) {
			Alert.alert("Error", err instanceof Error ? err.message : "Failed to update season.");
		}
	};

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={[]} style={styles.safeArea}>
				<ThemedText type="title" style={styles.title}>
					Seasons
				</ThemedText>
				<FlatList
					data={seasons}
					keyExtractor={(item) => item.id}
					renderItem={({ item }) => {
						const status = getSeasonStatus(item);
						return (
							<View style={styles.row}>
								<Pressable
									accessibilityRole="button"
									onPress={() => handlePress(item.slug)}
									style={({ pressed }) => [styles.rowInfo, pressed && styles.rowPressed]}
								>
									<ThemedText style={styles.rowName}>{item.name}</ThemedText>
									<ThemedText type="small" themeColor="textSecondary">
										{formatDate(item.startDate)}
										{item.endDate ? ` → ${formatDate(item.endDate)}` : ""}
									</ThemedText>
								</Pressable>
								<StatusPill status={status} />
								{isEditor ? (
									<View style={styles.rowActions}>
										<Button variant="outline" size="sm" onPress={() => setEditingSeason(item)}>
											Edit
										</Button>
										<Button variant="outline" size="sm" onPress={() => confirmToggleLock(item)}>
											{item.closed ? "Unlock" : "Lock"}
										</Button>
									</View>
								) : null}
							</View>
						);
					}}
					contentContainerStyle={styles.list}
					ListEmptyComponent={
						isLoading ? (
							<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
								Loading…
							</ThemedText>
						) : isError ? (
							<View style={styles.emptyBox}>
								<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
									Couldn’t load seasons
								</ThemedText>
								<Button variant="outline" onPress={() => refetch()}>
									Retry
								</Button>
							</View>
						) : (
							<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
								No seasons yet
							</ThemedText>
						)
					}
				/>
			</SafeAreaView>
			<EditSeasonModal
				season={editingSeason}
				isOpen={editingSeason !== null}
				onClose={() => setEditingSeason(null)}
			/>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		flexDirection: "row",
		justifyContent: "center",
	},
	safeArea: {
		flex: 1,
		maxWidth: MaxContentWidth,
		paddingHorizontal: Spacing.four,
		paddingBottom: Spacing.three,
	},
	title: {
		marginTop: Spacing.four,
		marginBottom: Spacing.three,
	},
	list: {
		paddingBottom: Spacing.four,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: Spacing.three,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "rgba(128,128,128,0.25)",
	},
	rowPressed: {
		backgroundColor: "rgba(128,128,128,0.08)",
	},
	rowInfo: {
		flex: 1,
	},
	rowName: {
		fontWeight: "600",
	},
	rowActions: {
		flexDirection: "row",
		gap: Spacing.one,
		marginLeft: Spacing.two,
	},
	pill: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.one,
		borderWidth: 1,
		borderRadius: 8,
		paddingVertical: 2,
		paddingHorizontal: Spacing.two,
		marginLeft: Spacing.three,
	},
	empty: {
		textAlign: "center",
		marginTop: Spacing.five,
	},
	emptyBox: {
		alignItems: "center",
		gap: Spacing.three,
	},
	modalContainer: {
		flex: 1,
	},
	keyboardAvoid: {
		flex: 1,
	},
	content: {
		flex: 1,
		paddingHorizontal: Spacing.four,
	},
	modalHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	modalTitle: {
		fontSize: 24,
		lineHeight: 32,
		fontWeight: "700",
		marginBottom: Spacing.four,
	},
	scroll: {
		flex: 1,
	},
	form: {
		gap: Spacing.three,
		paddingBottom: Spacing.four,
	},
	modalActions: {
		paddingTop: Spacing.three,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: "rgba(128,128,128,0.3)",
	},
});
