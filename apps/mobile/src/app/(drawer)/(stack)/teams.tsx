import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
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
import { HeaderPillButton } from "@/components/nav/header-buttons";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonListRow } from "@/components/ui/skeleton-rows";
import { MaxContentWidth, Spacing, SharedColors } from "@/constants/theme";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
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

type TeamFormTarget = { mode: "create" } | { mode: "edit"; team: { id: string; name: string } };

function TeamRoster({
	teamId,
	avatarHeaders,
}: {
	teamId: string;
	avatarHeaders: Record<string, string> | undefined;
}) {
	const theme = useTheme();
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [pendingPlayerId, setPendingPlayerId] = useState<string | null>(null);

	const { data: roster = [], isLoading: rosterLoading } = useQuery({
		queryKey: ["leagueTeam", "getPlayers", teamId],
		queryFn: () => trpcClient.leagueTeam.getPlayers.query({ teamId }),
	});
	const { data: leaguePlayers = [] } = useQuery({
		queryKey: ["player", "getAll"],
		queryFn: () => trpcClient.player.getAll.query(),
	});

	const rosterIds = new Set(roster.map((p) => p.id));
	const term = search.trim().toLowerCase();
	const availablePlayers = term
		? leaguePlayers
				.filter((p) => !p.disabled && !rosterIds.has(p.id))
				.filter((p) => p.name?.toLowerCase().includes(term))
				.slice(0, 8)
		: [];

	const updateRoster = async (playerId: string, action: "add" | "remove") => {
		if (pendingPlayerId) return;
		setPendingPlayerId(playerId);
		try {
			if (action === "add") {
				await trpcClient.leagueTeam.addPlayer.mutate({ teamId, playerId });
				setSearch("");
			} else {
				await trpcClient.leagueTeam.removePlayer.mutate({ teamId, playerId });
			}
			await queryClient.invalidateQueries({ queryKey: ["leagueTeam"] });
		} catch (err) {
			Alert.alert("Error", err instanceof Error ? err.message : "Failed to update roster.");
		} finally {
			setPendingPlayerId(null);
		}
	};

	return (
		<View style={styles.roster}>
			<ThemedText type="smallBold">Roster</ThemedText>
			{rosterLoading ? (
				<SkeletonListRow trailing={<Skeleton width={54} height={24} radius={7} />} />
			) : roster.length === 0 ? (
				<ThemedText type="small" themeColor="mutedForeground">
					No players assigned to this team
				</ThemedText>
			) : (
				roster.map((p) => (
					<View key={p.id} style={styles.row}>
						<Avatar name={p.name} image={getAvatarUri(p.image)} headers={avatarHeaders} size={32} />
						<ThemedText style={styles.rowInfo} numberOfLines={1}>
							{p.name}
						</ThemedText>
						<Button
							variant="ghost"
							size="sm"
							loading={pendingPlayerId === p.id}
							disabled={!!pendingPlayerId}
							onPress={() => updateRoster(p.id, "remove")}
						>
							Remove
						</Button>
					</View>
				))
			)}
			<Input
				label="Add player"
				placeholder="Search players"
				value={search}
				onChangeText={setSearch}
				autoCapitalize="none"
			/>
			{availablePlayers.map((p) => (
				<View key={p.id} style={styles.row}>
					<Avatar name={p.name} image={getAvatarUri(p.image)} headers={avatarHeaders} size={32} />
					<ThemedText style={styles.rowInfo} numberOfLines={1}>
						{p.name}
					</ThemedText>
					<Button
						variant="outline"
						size="sm"
						loading={pendingPlayerId === p.id}
						disabled={!!pendingPlayerId}
						onPress={() => updateRoster(p.id, "add")}
					>
						Add
					</Button>
				</View>
			))}
			{term && availablePlayers.length === 0 ? (
				<ThemedText type="small" style={{ color: theme.mutedForeground }}>
					No players to add
				</ThemedText>
			) : null}
		</View>
	);
}

function TeamFormModal({
	target,
	isEditor,
	avatarHeaders,
	onClose,
}: {
	target: TeamFormTarget | null;
	isEditor: boolean;
	avatarHeaders: Record<string, string> | undefined;
	onClose: () => void;
}) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const [apiError, setApiError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const team = target?.mode === "edit" ? target.team : null;

	useEffect(() => {
		if (target) {
			setName(target.mode === "edit" ? target.team.name : "");
			setSubmitted(false);
			setApiError("");
			setIsSubmitting(false);
			setIsDeleting(false);
		}
	}, [target]);

	const nameError = !submitted
		? undefined
		: !name.trim()
			? "Team name is required"
			: name.trim().length > 100
				? "Team name is too long"
				: undefined;

	const canSubmit = !isSubmitting && !!name.trim() && name.trim().length <= 100;

	const onSubmit = async () => {
		if (!target || isSubmitting) return;
		setSubmitted(true);
		setApiError("");
		setIsSubmitting(true);
		try {
			if (team) {
				await trpcClient.leagueTeam.edit.mutate({ teamId: team.id, name: name.trim() });
			} else {
				await trpcClient.leagueTeam.create.mutate({ name: name.trim() });
			}
			await queryClient.invalidateQueries({ queryKey: ["leagueTeam"] });
			onClose();
		} catch (err) {
			setApiError(err instanceof Error ? err.message : "Failed to save team.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const deleteTeam = async () => {
		if (!team || isDeleting) return;
		setIsDeleting(true);
		setApiError("");
		try {
			await trpcClient.leagueTeam.delete.mutate({ teamId: team.id });
			await queryClient.invalidateQueries({ queryKey: ["leagueTeam"] });
			onClose();
		} catch (err) {
			setApiError(err instanceof Error ? err.message : "Failed to delete team.");
		} finally {
			setIsDeleting(false);
		}
	};

	const confirmDelete = () => {
		if (!team) return;
		Alert.alert(
			"Delete team",
			`"${team.name}" and its roster are permanently deleted. Teams with match history cannot be deleted.`,
			[
				{ text: "Cancel", style: "cancel" },
				{ text: "Delete", style: "destructive", onPress: deleteTeam },
			]
		);
	};

	return (
		<Modal visible={target !== null} animationType="slide" onRequestClose={onClose}>
			<ThemedView style={styles.modalContainer}>
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : undefined}
					style={styles.keyboardAvoid}
				>
					<View style={[styles.content, { paddingTop: insets.top + Spacing.three }]}>
						<View style={styles.modalHeader}>
							<ThemedText type="subtitle" style={styles.modalTitle}>
								{team ? "Edit Team" : "Create Team"}
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
							{team && isEditor ? (
								<>
									<TeamRoster teamId={team.id} avatarHeaders={avatarHeaders} />
									<Button variant="ghost" onPress={confirmDelete} loading={isDeleting}>
										Delete team
									</Button>
								</>
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
									? team
										? "Saving..."
										: "Creating..."
									: team
										? "Save Changes"
										: "Create Team"}
							</Button>
						</View>
					</View>
				</KeyboardAvoidingView>
			</ThemedView>
		</Modal>
	);
}

const TEAM_FILTERS = [
	{ value: "all", label: "All Teams" },
	{ value: "my", label: "My Teams" },
] as const;

export default function TeamsScreen() {
	const [teamView, setTeamView] = useState<"all" | "my">("all");
	const [cookie, setCookie] = useState<string | undefined>();
	const [formTarget, setFormTarget] = useState<TeamFormTarget | null>(null);
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

	const { data: myPlayer, refetch: refetchMyPlayer } = useQuery({
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
	const { refreshing, onRefresh } = usePullToRefresh(() =>
		Promise.all([refetch(), refetchMyPlayer()])
	);

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={[]} style={styles.safeArea}>
				<Stack.Screen
					options={{
						headerRight: isEditor
							? () => (
									<HeaderPillButton
										icon={{ ios: "plus", android: "add", web: "add" }}
										label="Team"
										tone="glow"
										onPress={() => setFormTarget({ mode: "create" })}
									/>
								)
							: undefined,
					}}
				/>
				{myPlayer ? (
					<View style={styles.filter}>
						<SegmentedControl options={TEAM_FILTERS} value={teamView} onChange={setTeamView} />
					</View>
				) : null}
				<FlatList
					style={styles.list}
					data={teams}
					keyExtractor={(item) => item.id}
					refreshing={refreshing}
					onRefresh={onRefresh}
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
								<ThemedText type="small" themeColor="mutedForeground" numberOfLines={1}>
									{memberSummary(item.players)}
								</ThemedText>
							</View>
							{isEditor ? (
								<Button
									variant="outline"
									size="sm"
									onPress={() =>
										setFormTarget({ mode: "edit", team: { id: item.id, name: item.name } })
									}
								>
									Edit
								</Button>
							) : null}
						</View>
					)}
					contentContainerStyle={styles.listContent}
					ListEmptyComponent={
						isLoading ? (
							<View>
								{Array.from({ length: 6 }).map((_, i) => (
									<SkeletonListRow
										key={i}
										trailing={<Skeleton width={54} height={24} radius={7} />}
									/>
								))}
							</View>
						) : isError ? (
							<View style={styles.emptyBox}>
								<ThemedText type="small" themeColor="mutedForeground" style={styles.empty}>
									Couldn’t load teams
								</ThemedText>
								<Button variant="outline" onPress={() => refetch()}>
									Retry
								</Button>
							</View>
						) : (
							<ThemedText type="small" themeColor="mutedForeground" style={styles.empty}>
								No teams yet
							</ThemedText>
						)
					}
				/>
			</SafeAreaView>
			<TeamFormModal
				target={formTarget}
				isEditor={isEditor}
				avatarHeaders={avatarHeaders}
				onClose={() => setFormTarget(null)}
			/>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	filter: {
		paddingVertical: Spacing.three,
	},
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
		paddingHorizontal: Spacing.three,
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
		borderBottomColor: SharedColors.divider,
	},
	rowInfo: {
		flex: 1,
	},
	rowName: {
		fontWeight: "400",
	},
	empty: {
		textAlign: "center",
		marginTop: Spacing.five,
	},
	emptyBox: {
		alignItems: "center",
		gap: Spacing.three,
	},
	roster: {
		gap: Spacing.two,
		marginTop: Spacing.three,
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
		borderTopColor: SharedColors.dividerBorder,
	},
});
