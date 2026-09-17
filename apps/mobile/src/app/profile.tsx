import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { EditProfileModal } from "@/components/profile/edit-profile-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useUserAvatar } from "@/hooks/use-user-avatar";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import { unregisterPushNotifications } from "@/lib/notifications";
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

export default function ProfileScreen() {
	const theme = useTheme();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { data: sessionData, refetch } = authClient.useSession();
	const user = sessionData?.user;
	const currentSession = sessionData?.session;
	const { uri, headers } = useUserAvatar(user?.image);
	const [isEditOpen, setIsEditOpen] = useState(false);

	const leaguesQuery = useQuery(trpc.league.list.queryOptions());
	const matchesQuery = useQuery(trpc.user.getTotalMatches.queryOptions());
	const sessionsQuery = useQuery({
		queryKey: ["sessions"],
		queryFn: async () => {
			const res = await authClient.listSessions();
			return res.data ?? [];
		},
	});
	const { refreshing, onRefresh } = usePullToRefresh(() =>
		Promise.all([leaguesQuery.refetch(), matchesQuery.refetch(), sessionsQuery.refetch()])
	);

	const signOut = useCallback(async () => {
		await performSignOut();
		queryClient.clear();
		router.replace("/sign-in");
	}, [queryClient]);

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
					await unregisterPushNotifications();
					await authClient.revokeSessions();
					await authClient.signOut();
					queryClient.clear();
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
							size={96}
							borderRadius={24}
						/>
						<ThemedText type="subtitle" numberOfLines={1}>
							{user?.name ?? ""}
						</ThemedText>
						<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
							{user?.email ?? ""}
						</ThemedText>
						<Button variant="outline" size="sm" onPress={() => setIsEditOpen(true)}>
							Edit Profile
						</Button>
					</View>

					<View style={styles.stats}>
						<Card style={styles.statCard}>
							<CardHeader>
								<CardTitle>Leagues</CardTitle>
							</CardHeader>
							<CardContent>
								<ThemedText type="subtitle">{leagueCount}</ThemedText>
								<ThemedText type="small" themeColor="textSecondary">
									Active leagues
								</ThemedText>
							</CardContent>
						</Card>
						<Card style={styles.statCard}>
							<CardHeader>
								<CardTitle>Matches</CardTitle>
							</CardHeader>
							<CardContent>
								<ThemedText type="subtitle">{totalMatches}</ThemedText>
								<ThemedText type="small" themeColor="textSecondary">
									Total matches played
								</ThemedText>
							</CardContent>
						</Card>
					</View>

					<Card>
						<CardHeader style={styles.sectionHeader}>
							<CardTitle>Sessions</CardTitle>
							<View style={styles.sectionActions}>
								<Button variant="ghost" size="sm" onPress={revokeOther}>
									Revoke Other
								</Button>
								<Button variant="ghost" size="sm" onPress={revokeAll}>
									Revoke All
								</Button>
							</View>
						</CardHeader>
						<CardContent style={styles.list}>
							{sessionsQuery.isPending ? (
								<ThemedText type="small" themeColor="textSecondary">
									Loading sessions…
								</ThemedText>
							) : sessions.length === 0 ? (
								<ThemedText type="small" themeColor="textSecondary">
									No active sessions
								</ThemedText>
							) : (
								sessions.map((s) => {
									const isCurrent = s.id === currentSession?.id;
									return (
										<View key={s.id} style={[styles.row, { borderBottomColor: theme.border }]}>
											<View style={styles.rowInfo}>
												<ThemedText type="smallBold" numberOfLines={1}>
													{isCurrent ? "Current Session" : parseUserAgent(s.userAgent)}
												</ThemedText>
												<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
													{parseUserAgent(s.userAgent)} · {formatSessionDate(s.createdAt)}
												</ThemedText>
											</View>
											{isCurrent ? (
												<Pressable onPress={signOut} hitSlop={8}>
													<ThemedText type="smallBold" style={{ color: theme.destructive }}>
														Sign Out
													</ThemedText>
												</Pressable>
											) : null}
										</View>
									);
								})
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Notifications</CardTitle>
						</CardHeader>
						<CardContent>
							<Button
								variant="outline"
								fullWidth
								onPress={() => router.push("/settings/notifications")}
							>
								Configure push notifications
							</Button>
						</CardContent>
					</Card>

					<Button variant="outline" fullWidth onPress={signOut}>
						Sign Out
					</Button>
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
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, flexDirection: "row", justifyContent: "center" },
	safeArea: { flex: 1, maxWidth: MaxContentWidth, paddingHorizontal: Spacing.three },
	scroll: { gap: Spacing.three, paddingVertical: Spacing.three },
	hero: { alignItems: "center", gap: Spacing.two, paddingVertical: Spacing.three },
	stats: { flexDirection: "row", gap: Spacing.three },
	statCard: { flex: 1 },
	sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	sectionActions: { flexDirection: "row", gap: Spacing.one },
	list: { gap: 0 },
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Spacing.two,
		paddingVertical: Spacing.two,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	rowInfo: { flex: 1, gap: 1 },
});
