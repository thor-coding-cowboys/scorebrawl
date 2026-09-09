import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
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
import { trpcClient } from "@/lib/trpc";

function memberSummary(players: { name: string | null }[]) {
	const firstNames = players.map((p) => p.name?.split(" ")[0] ?? "Unknown");
	if (firstNames.length === 0) return "No players";
	if (firstNames.length === 1) return firstNames[0];
	if (firstNames.length === 2) return `${firstNames[0]} & ${firstNames[1]}`;
	return `${firstNames.slice(0, -1).join(", ")} & ${firstNames[firstNames.length - 1]}`;
}

function EditTeamModal({
	team,
	isOpen,
	onClose,
}: {
	team: { id: string; name: string } | null;
	isOpen: boolean;
	onClose: () => void;
}) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const [apiError, setApiError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (isOpen && team) {
			setName(team.name);
			setSubmitted(false);
			setApiError("");
			setIsSubmitting(false);
		}
	}, [isOpen, team]);

	const nameError = !submitted
		? undefined
		: !name.trim()
			? "Team name is required"
			: name.trim().length > 100
				? "Team name is too long"
				: undefined;

	const canSubmit = !isSubmitting && !!name.trim() && name.trim().length <= 100;

	const onSubmit = async () => {
		if (!team || isSubmitting) return;
		setSubmitted(true);
		setApiError("");
		setIsSubmitting(true);
		try {
			await trpcClient.leagueTeam.edit.mutate({ teamId: team.id, name: name.trim() });
			await queryClient.invalidateQueries({ queryKey: ["leagueTeam"] });
			onClose();
		} catch (err) {
			setApiError(err instanceof Error ? err.message : "Failed to save team.");
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
								Edit Team
							</ThemedText>
							<ModalCloseButton onPress={onClose} />
						</View>

						<ScrollView
							style={styles.scroll}
							contentContainerStyle={styles.form}
							keyboardShouldPersistTaps="handled"
						>
							<Input
								label="Team Name"
								placeholder="Team name"
								value={name}
								onChangeText={(text) => {
									setName(text);
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
								{isSubmitting ? "Saving..." : "Save Changes"}
							</Button>
						</View>
					</View>
				</KeyboardAvoidingView>
			</ThemedView>
		</Modal>
	);
}

export default function TeamsScreen() {
	const params = useLocalSearchParams<{ view?: "all" | "my" }>();
	const teamView = params.view ?? "all";
	const [cookie, setCookie] = useState<string | undefined>();
	const [editingTeam, setEditingTeam] = useState<{ id: string; name: string } | null>(null);
	const { data: activeMember } = authClient.useActiveMember();
	const role = activeMember?.role;
	const isEditor = role === "owner" || role === "editor";

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

	const { data: myPlayer } = useQuery({
		queryKey: ["player", "getMyPlayer"],
		queryFn: () => trpcClient.player.getMyPlayer.query(),
	});

	const showMyTeams = teamView === "my" && !!myPlayer;

	const { data, isLoading, isError, refetch } = useQuery({
		queryKey: ["leagueTeam", "list", showMyTeams ? myPlayer?.id : undefined],
		queryFn: () =>
			trpcClient.leagueTeam.list.query({
				limit: 100,
				playerId: showMyTeams && myPlayer?.id ? myPlayer.id : undefined,
			}),
		enabled: !showMyTeams || !!myPlayer,
	});
	const teams = data?.teams ?? [];

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={[]} style={styles.safeArea}>
				<ThemedText type="title" style={styles.title}>
					Teams
				</ThemedText>
				<FlatList
					style={styles.list}
					data={teams}
					keyExtractor={(item) => item.id}
					renderItem={({ item }) => (
						<View style={styles.row}>
							<Avatar
								name={item.name}
								image={getAvatarUri(item.logo)}
								headers={avatarHeaders}
								size={40}
							/>
							<View style={styles.rowInfo}>
								<ThemedText style={styles.rowName} numberOfLines={1}>
									{item.name}
								</ThemedText>
								<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
									{memberSummary(item.players)}
								</ThemedText>
							</View>
							{isEditor ? (
								<Button
									variant="outline"
									size="sm"
									onPress={() => setEditingTeam({ id: item.id, name: item.name })}
								>
									Edit
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
									Couldn’t load teams
								</ThemedText>
								<Button variant="outline" onPress={() => refetch()}>
									Retry
								</Button>
							</View>
						) : (
							<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
								No teams yet
							</ThemedText>
						)
					}
				/>
			</SafeAreaView>
			<EditTeamModal
				team={editingTeam}
				isOpen={editingTeam !== null}
				onClose={() => setEditingTeam(null)}
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
	content: {
		flex: 1,
		paddingHorizontal: Spacing.four,
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
	rowName: {
		fontWeight: "600",
	},
	empty: {
		textAlign: "center",
		marginTop: Spacing.five,
	},
	emptyBox: {
		alignItems: "center",
		gap: Spacing.three,
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
