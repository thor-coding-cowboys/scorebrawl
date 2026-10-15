import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { EditProfileModal } from "@/components/profile/edit-profile-modal";
import { RenamePasskeyModal } from "@/components/profile/rename-passkey-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonListRow } from "@/components/ui/skeleton-rows";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useUserAvatar } from "@/hooks/use-user-avatar";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import { isPasskeyEnabled } from "@/lib/auth-options";
import { signOut as performSignOut } from "@/lib/sign-out";
import { useTRPC } from "@/lib/trpc";

function formatSessionDate(value: Date | string) {
	return new Date(value).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function parseUserAgent(ua?: string | null) {
	if (!ua) return "Unknown device";
	const browser = /Chrome/.test(ua)
		? "Chrome"
		: /Firefox/.test(ua)
			? "Firefox"
			: /Safari/.test(ua)
				? "Safari"
				: /Edg/.test(ua)
					? "Edge"
					: "Browser";
	const os = /Windows/.test(ua)
		? "Windows"
		: /Mac OS/.test(ua)
			? "macOS"
			: /Linux/.test(ua)
				? "Linux"
				: /Android/.test(ua)
					? "Android"
					: /iPhone|iPad/.test(ua)
						? "iOS"
						: "";
	return os ? `${browser} on ${os}` : browser;
}

function Divider() {
	const theme = useTheme();
	return <View style={[styles.divider, { backgroundColor: theme.border }]} />;
}

function SectionLabel({ children }: { children: string }) {
	return (
		<ThemedText style={styles.sectionLabel} themeColor="mutedForeground">
			{children.toUpperCase()}
		</ThemedText>
	);
}

function Stat({ value, label }: { value: number; label: string }) {
	return (
		<View style={styles.stat}>
			<ThemedText style={styles.statValue}>{value}</ThemedText>
			<ThemedText style={styles.statLabel} themeColor="mutedForeground">
				{label.toUpperCase()}
			</ThemedText>
		</View>
	);
}

export default function ProfileScreen() {
	const theme = useTheme();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { data: sessionData, refetch } = authClient.useSession();
	const user = sessionData?.user;
	const currentSession = sessionData?.session;
	const { uri, headers } = useUserAvatar(user?.image);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [editingPasskey, setEditingPasskey] = useState<{ id: string; name: string } | null>(null);
	const [passkeyError, setPasskeyError] = useState("");

	const leaguesQuery = useQuery(trpc.league.list.queryOptions());
	const matchesQuery = useQuery(trpc.user.getTotalMatches.queryOptions());
	const sessionsQuery = useQuery({
		queryKey: ["sessions"],
		queryFn: async () => {
			const res = await authClient.listSessions();
			return res.data ?? [];
		},
	});

	const passkeysQuery = useQuery({
		queryKey: ["passkeys"],
		queryFn: async () => {
			const { data, error } = await authClient.passkey.listUserPasskeys({});
			if (error) throw new Error(error.message || "Failed to load passkeys");
			return data ?? [];
		},
	});

	const addPasskey = useMutation({
		mutationFn: async () => {
			const { data, error } = await authClient.passkey.addPasskey();
			if (error) throw new Error(error.message || "Failed to add passkey");
			return data;
		},
		onSuccess: () => {
			setPasskeyError("");
			void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
		},
		onError: (err) => setPasskeyError(err instanceof Error ? err.message : "Failed to add passkey"),
	});

	const renamePasskey = useMutation({
		mutationFn: async ({ id, name }: { id: string; name: string }) => {
			const { data, error } = await authClient.passkey.updatePasskey({ id, name });
			if (error) throw new Error(error.message || "Failed to update passkey");
			return data;
		},
		onSuccess: () => {
			setPasskeyError("");
			setEditingPasskey(null);
			void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
		},
		onError: (err) =>
			setPasskeyError(err instanceof Error ? err.message : "Failed to update passkey"),
	});

	const deletePasskey = useMutation({
		mutationFn: async (id: string) => {
			const { data, error } = await authClient.passkey.deletePasskey({ id });
			if (error) throw new Error(error.message || "Failed to delete passkey");
			return data;
		},
		onSuccess: () => {
			setPasskeyError("");
			void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
		},
		onError: (err) =>
			setPasskeyError(err instanceof Error ? err.message : "Failed to delete passkey"),
	});

	const passkeys = passkeysQuery.data ?? [];

	const { refreshing, onRefresh } = usePullToRefresh(() =>
		Promise.all([
			leaguesQuery.refetch(),
			matchesQuery.refetch(),
			sessionsQuery.refetch(),
			passkeysQuery.refetch(),
		])
	);

	const signOut = useCallback(async () => {
		await performSignOut();
		queryClient.clear();
		router.replace("/sign-in");
	}, [queryClient]);

	const confirmDeletePasskey = (passkey: { id: string; name?: string | null }) => {
		Alert.alert(
			"Delete passkey?",
			`"${passkey.name || "Unnamed passkey"}" will be removed. This cannot be undone.`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: () => deletePasskey.mutate(passkey.id),
				},
			]
		);
	};

	const revokeOther = () => {
		Alert.alert("Revoke Other Sessions", "Sign out of all other devices and browsers?", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Revoke Other",
				style: "destructive",
				onPress: async () => {
					await authClient.revokeOtherSessions();
					await sessionsQuery.refetch();
				},
			},
		]);
	};

	const revokeAll = () => {
		Alert.alert("Revoke All Sessions", "Sign out of ALL devices including this one?", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "Revoke All",
				style: "destructive",
				onPress: async () => {
					await authClient.revokeSessions();
					await performSignOut();
					router.replace("/sign-in");
				},
			},
		]);
	};

	const leagueCount = leaguesQuery.data?.leagues.length ?? 0;
	const totalMatches = matchesQuery.data ?? 0;
	const sessions = sessionsQuery.data ?? [];

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={[]} style={styles.safeArea}>
				<ScrollView
					contentContainerStyle={styles.scroll}
					refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
				>
					<View style={styles.hero}>
						<Avatar
							name={user?.name ?? "?"}
							image={uri}
							headers={headers}
							size={80}
							borderRadius={20}
						/>
						<ThemedText type="subtitle" style={styles.heroName}>
							{user?.name ?? ""}
						</ThemedText>
						<ThemedText
							type="small"
							themeColor="mutedForeground"
							numberOfLines={1}
							style={styles.heroName}
						>
							{user?.email ?? ""}
						</ThemedText>
					</View>

					<View style={styles.heroActions}>
						<Button variant="outline" size="sm" onPress={() => setIsEditOpen(true)}>
							Edit profile
						</Button>
					</View>

					<Divider />

					<View style={styles.stats}>
						<Stat value={leagueCount} label="Leagues" />
						<View style={[styles.statDivider, { backgroundColor: theme.border }]} />
						<Stat value={totalMatches} label="Matches" />
					</View>

					<Divider />

					<View>
						<View style={styles.sectionHeader}>
							<SectionLabel>Sessions</SectionLabel>
							<View style={styles.sectionActions}>
								<Pressable accessibilityRole="button" onPress={revokeOther} hitSlop={8}>
									<ThemedText type="small" themeColor="mutedForeground">
										Revoke others
									</ThemedText>
								</Pressable>
								<Pressable accessibilityRole="button" onPress={revokeAll} hitSlop={8}>
									<ThemedText type="small" style={{ color: theme.destructive }}>
										Revoke all
									</ThemedText>
								</Pressable>
							</View>
						</View>

						{sessionsQuery.isPending ? (
							<View>
								{Array.from({ length: 3 }).map((_, i) => (
									<SkeletonListRow
										key={i}
										avatarSize={null}
										trailing={<Skeleton width={48} height={12} />}
									/>
								))}
							</View>
						) : sessionsQuery.isError ? (
							<ThemedText type="small" themeColor="mutedForeground">
								Couldn't load sessions
							</ThemedText>
						) : sessions.length === 0 ? (
							<ThemedText type="small" themeColor="mutedForeground">
								No active sessions
							</ThemedText>
						) : (
							sessions.map((s, index) => {
								const isCurrent = s.id === currentSession?.id;
								return (
									<View
										key={s.id}
										style={[
											styles.sessionRow,
											index < sessions.length - 1 && {
												borderBottomWidth: StyleSheet.hairlineWidth,
												borderBottomColor: theme.border,
											},
										]}
									>
										<View style={styles.sessionInfo}>
											<ThemedText numberOfLines={1}>
												{isCurrent ? "This device" : parseUserAgent(s.userAgent)}
											</ThemedText>
											<ThemedText type="small" themeColor="mutedForeground" numberOfLines={1}>
												{isCurrent ? "Current session · " : ""}
												{formatSessionDate(s.createdAt)}
											</ThemedText>
										</View>
										{isCurrent ? (
											<ThemedText type="small" style={{ color: theme.primary }}>
												Active
											</ThemedText>
										) : null}
									</View>
								);
							})
						)}
					</View>

					{isPasskeyEnabled && (
						<>
							<Divider />

							<View>
								<View style={styles.sectionHeader}>
									<SectionLabel>Passkeys</SectionLabel>
									<Pressable
										accessibilityRole="button"
										hitSlop={8}
										disabled={addPasskey.isPending}
										onPress={() => addPasskey.mutate()}
									>
										<ThemedText
											type="small"
											themeColor={addPasskey.isPending ? "mutedForeground" : "primary"}
										>
											{addPasskey.isPending ? "Adding…" : "Add passkey"}
										</ThemedText>
									</Pressable>
								</View>

								{passkeyError ? (
									<ThemedText type="small" style={{ color: theme.destructive }}>
										{passkeyError}
									</ThemedText>
								) : null}

								{passkeysQuery.isPending ? (
									<ThemedText type="small" themeColor="mutedForeground">
										Loading passkeys…
									</ThemedText>
								) : passkeysQuery.isError ? (
									<ThemedText type="small" themeColor="mutedForeground">
										Couldn't load passkeys
									</ThemedText>
								) : passkeys.length === 0 ? (
									<ThemedText type="small" themeColor="mutedForeground">
										No passkeys yet. Add one to sign in without a password.
									</ThemedText>
								) : (
									passkeys.map((passkey, index) => (
										<View
											key={passkey.id}
											style={[
												styles.sessionRow,
												index < passkeys.length - 1 && {
													borderBottomWidth: StyleSheet.hairlineWidth,
													borderBottomColor: theme.border,
												},
											]}
										>
											<View style={styles.sessionInfo}>
												<ThemedText numberOfLines={1}>
													{passkey.name || "Unnamed passkey"}
												</ThemedText>
												<ThemedText type="small" themeColor="mutedForeground" numberOfLines={1}>
													{passkey.deviceType}
													{passkey.backedUp ? " · Backed up" : ""}
												</ThemedText>
											</View>
											<View style={styles.sectionActions}>
												<Pressable
													accessibilityRole="button"
													hitSlop={8}
													onPress={() =>
														setEditingPasskey({ id: passkey.id, name: passkey.name || "" })
													}
												>
													<ThemedText type="small" themeColor="mutedForeground">
														Rename
													</ThemedText>
												</Pressable>
												<Pressable
													accessibilityRole="button"
													hitSlop={8}
													onPress={() => confirmDeletePasskey(passkey)}
												>
													<ThemedText type="small" style={{ color: theme.destructive }}>
														Delete
													</ThemedText>
												</Pressable>
											</View>
										</View>
									))
								)}
							</View>
						</>
					)}

					<Divider />

					<Pressable
						accessibilityRole="button"
						onPress={() => router.push("/settings/notifications")}
						style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.6 }]}
					>
						<View style={styles.linkInfo}>
							<SectionLabel>Notifications</SectionLabel>
							<ThemedText type="small" themeColor="mutedForeground" numberOfLines={1}>
								Sessions, matches, achievements, streaks
							</ThemedText>
						</View>
						<SymbolView
							name={{ ios: "chevron.right", android: "chevron_right", web: "chevron_right" }}
							size={14}
							tintColor={theme.mutedForeground}
						/>
					</Pressable>

					<Divider />

					<Pressable
						accessibilityRole="button"
						onPress={signOut}
						style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.6 }]}
					>
						<ThemedText style={{ color: theme.destructive }}>Sign out</ThemedText>
					</Pressable>
				</ScrollView>
			</SafeAreaView>

			<EditProfileModal
				isOpen={isEditOpen}
				onClose={() => {
					setIsEditOpen(false);
					void refetch();
				}}
				user={user ?? {}}
			/>

			<RenamePasskeyModal
				isOpen={editingPasskey !== null}
				currentName={editingPasskey?.name ?? ""}
				isSaving={renamePasskey.isPending}
				onClose={() => setEditingPasskey(null)}
				onSave={(name) => {
					if (editingPasskey) renamePasskey.mutate({ id: editingPasskey.id, name });
				}}
			/>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, flexDirection: "row", justifyContent: "center" },
	safeArea: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.four },
	scroll: { paddingVertical: Spacing.five, paddingBottom: Spacing.six },
	hero: { alignItems: "center", gap: Spacing.two },
	heroName: { textAlign: "center" },
	heroActions: { alignItems: "center", paddingTop: Spacing.three },
	divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.four },
	stats: { flexDirection: "row", alignItems: "stretch" },
	stat: { flex: 1, gap: Spacing.one },
	statDivider: { width: StyleSheet.hairlineWidth, marginHorizontal: Spacing.four },
	statValue: { fontSize: 40, lineHeight: 44, fontVariant: ["tabular-nums"] },
	statLabel: { fontSize: 11, lineHeight: 14, letterSpacing: 1.4 },
	sectionHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: Spacing.three,
	},
	sectionLabel: { fontSize: 11, lineHeight: 14, letterSpacing: 1.4 },
	sectionActions: { flexDirection: "row", gap: Spacing.three },
	sessionRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Spacing.three,
		paddingVertical: Spacing.three,
	},
	sessionInfo: { flex: 1, gap: Spacing.half },
	linkRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Spacing.three,
		paddingVertical: Spacing.two,
	},
	linkInfo: { flex: 1, gap: Spacing.half },
	signOut: { paddingVertical: Spacing.two },
});
