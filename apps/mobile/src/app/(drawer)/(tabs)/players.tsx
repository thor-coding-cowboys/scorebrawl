import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
	Alert,
	FlatList,
	KeyboardAvoidingView,
	Modal,
	Platform,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { getAvatarUri } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { authClient, getAuthCookie } from "@/lib/auth-client";
import { trpcClient, type RouterOutput } from "@/lib/trpc";

type Player = RouterOutput["player"]["getAll"][number];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function GuestBadge() {
	const theme = useTheme();
	return (
		<View
			style={[
				styles.badge,
				{
					backgroundColor: `${theme.textSecondary}1a`,
					borderColor: `${theme.textSecondary}40`,
				},
			]}
		>
			<ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>
				Guest
			</ThemedText>
		</View>
	);
}

type GuestFormState =
	| { mode: "create" }
	| { mode: "edit"; player: Pick<Player, "id" | "email" | "name"> };

function GuestPlayerForm({
	state,
	isOpen,
	onClose,
}: {
	state: GuestFormState;
	isOpen: boolean;
	onClose: () => void;
}) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const queryClient = useQueryClient();
	const [email, setEmail] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const [apiError, setApiError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (isOpen) {
			setEmail(state.mode === "edit" ? (state.player.email ?? "") : "");
			setDisplayName(state.mode === "edit" ? state.player.name : "");
			setSubmitted(false);
			setApiError("");
			setIsSubmitting(false);
		}
	}, [isOpen, state]);

	const emailError = !submitted
		? undefined
		: !EMAIL_REGEX.test(email)
			? "Enter a valid email address"
			: undefined;
	const nameError = !submitted
		? undefined
		: !displayName.trim()
			? "Display name is required"
			: displayName.trim().length > 100
				? "Display name is too long"
				: undefined;

	const canSubmit =
		!isSubmitting &&
		EMAIL_REGEX.test(email) &&
		!!displayName.trim() &&
		displayName.trim().length <= 100;

	const onSubmit = async () => {
		if (isSubmitting) return;
		setSubmitted(true);
		setApiError("");
		setIsSubmitting(true);
		try {
			if (state.mode === "create") {
				await trpcClient.player.createGuestPlayer.mutate({ email, displayName });
			} else {
				await trpcClient.player.editGuestPlayer.mutate({
					playerId: state.player.id,
					email,
					displayName,
				});
			}
			await queryClient.invalidateQueries({ queryKey: ["player"] });
			onClose();
		} catch (err) {
			setApiError(err instanceof Error ? err.message : "Failed to save guest player.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const title = state.mode === "create" ? "Add Guest Player" : "Edit Guest Player";

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
								{title}
							</ThemedText>
							<ModalCloseButton onPress={onClose} />
						</View>

						<ScrollView
							style={styles.scroll}
							contentContainerStyle={styles.form}
							keyboardShouldPersistTaps="handled"
						>
							<Input
								label="Email"
								placeholder="guest@example.com"
								value={email}
								onChangeText={(text) => {
									setEmail(text);
									setApiError("");
								}}
								autoCapitalize="none"
								autoCorrect={false}
								keyboardType="email-address"
								editable={!isSubmitting}
								error={emailError}
							/>
							<Input
								label="Display Name"
								placeholder="Guest Player"
								value={displayName}
								onChangeText={(text) => {
									setDisplayName(text);
									setApiError("");
								}}
								editable={!isSubmitting}
								error={nameError}
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
								{isSubmitting
									? "Saving..."
									: state.mode === "create"
										? "Add Guest"
										: "Save Changes"}
							</Button>
						</View>
					</View>
				</KeyboardAvoidingView>
			</ThemedView>
		</Modal>
	);
}

export default function PlayersScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ create?: string; view?: "enabled" | "disabled" }>();
	const theme = useTheme();
	const queryClient = useQueryClient();
	const { data: activeMember, isPending: isMemberPending } = authClient.useActiveMember();
	const isEditor = activeMember?.role === "owner" || activeMember?.role === "editor";
	const playerView = params.view ?? "enabled";
	const [cookie, setCookie] = useState<string | undefined>();
	const [guestForm, setGuestForm] = useState<GuestFormState | null>(null);
	const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		getAuthCookie().then((c) => {
			if (active) setCookie(c);
		});
		return () => {
			active = false;
		};
	}, []);
	const avatarHeaders = cookie ? { cookie } : undefined;

	useEffect(() => {
		if (params.create !== "1") return;
		if (isMemberPending) return;
		if (isEditor) {
			setGuestForm({ mode: "create" });
		}
		router.setParams({ create: undefined });
	}, [params.create, isEditor, isMemberPending, router]);

	const {
		data: players = [],
		isLoading,
		isError,
		refetch,
	} = useQuery({
		queryKey: ["player", "getAll"],
		queryFn: () => trpcClient.player.getAll.query(),
	});

	const visiblePlayers = players.filter((p) =>
		playerView === "disabled" ? p.disabled : !p.disabled
	);

	const confirmToggleDisabled = (player: Player) => {
		Alert.alert(
			player.disabled ? "Enable player" : "Disable player",
			player.disabled
				? `${player.name} will be able to join matches again.`
				: `${player.name} won't be able to join matches while disabled.`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: player.disabled ? "Enable" : "Disable",
					style: player.disabled ? undefined : "destructive",
					onPress: () => handleSetDisabled(player),
				},
			]
		);
	};

	const handleSetDisabled = async (player: Player) => {
		if (pendingToggleId) return;
		setPendingToggleId(player.id);
		try {
			await trpcClient.player.setDisabled.mutate({
				playerId: player.id,
				disabled: !player.disabled,
			});
			await queryClient.invalidateQueries({ queryKey: ["player"] });
		} catch (err) {
			Alert.alert("Error", err instanceof Error ? err.message : "Failed to update player.");
		} finally {
			setPendingToggleId(null);
		}
	};

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={[]} style={styles.safeArea}>
				<ThemedText type="title" style={styles.title}>
					Players
				</ThemedText>
				<FlatList
					style={styles.list}
					data={visiblePlayers}
					keyExtractor={(item) => item.id}
					renderItem={({ item }) => (
						<View style={styles.row}>
							<Avatar
								name={item.name}
								image={getAvatarUri(item.image)}
								headers={avatarHeaders}
								size={40}
							/>
							<View style={styles.rowInfo}>
								<View style={styles.nameRow}>
									<ThemedText style={styles.rowName} numberOfLines={1}>
										{item.name}
									</ThemedText>
									{item.isGuest ? <GuestBadge /> : null}
								</View>
								<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
									{item.email ?? "No email"}
								</ThemedText>
							</View>
							{isEditor ? (
								<Button
									variant="outline"
									size="sm"
									onPress={() => confirmToggleDisabled(item)}
									loading={pendingToggleId === item.id}
								>
									{item.disabled ? "Enable" : "Disable"}
								</Button>
							) : null}
						</View>
					)}
					contentContainerStyle={styles.listContent}
					ListEmptyComponent={
						isLoading ? (
							<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
								Loading…
							</ThemedText>
						) : isError ? (
							<View style={styles.emptyBox}>
								<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
									Couldn’t load players
								</ThemedText>
								<Button variant="outline" onPress={() => refetch()}>
									Retry
								</Button>
							</View>
						) : (
							<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
								No players yet
							</ThemedText>
						)
					}
				/>
			</SafeAreaView>
			<GuestPlayerForm
				state={guestForm ?? { mode: "create" }}
				isOpen={guestForm !== null}
				onClose={() => setGuestForm(null)}
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
	modalContainer: {
		flex: 1,
	},
	keyboardAvoid: {
		flex: 1,
	},
	safeArea: {
		flex: 1,
		maxWidth: MaxContentWidth,
		paddingHorizontal: Spacing.four,
		paddingBottom: Spacing.three,
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginTop: Spacing.four,
		marginBottom: Spacing.three,
	},
	title: {
		marginTop: Spacing.four,
		marginBottom: Spacing.three,
	},
	list: {
		flex: 1,
	},
	listContent: {
		paddingBottom: Spacing.six,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		paddingVertical: Spacing.three,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "rgba(128,128,128,0.25)",
	},
	rowInfo: {
		flex: 1,
	},
	nameRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
	},
	rowName: {
		fontWeight: "600",
		flexShrink: 1,
	},
	badge: {
		flexDirection: "row",
		alignItems: "center",
		borderWidth: 1,
		borderRadius: 8,
		paddingVertical: 1,
		paddingHorizontal: Spacing.two,
	},
	empty: {
		textAlign: "center",
		marginTop: Spacing.five,
	},
	emptyBox: {
		alignItems: "center",
		gap: Spacing.three,
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
