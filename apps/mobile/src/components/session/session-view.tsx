import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HeaderActions, HeaderIconButton, HeaderPillButton } from "@/components/nav/header-buttons";
import { AddPlayerModal } from "@/components/session/add-player-modal";
import { NextMatchTab } from "@/components/session/next-match-tab";
import { SessionConfigModal } from "@/components/session/session-config-modal";
import { SessionPlayerStandings, SessionTeamStandings } from "@/components/session/standings-tab";
import type { GameSession } from "@/components/session/types";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { SectionCard } from "@/components/ui/section-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useActiveLeague } from "@/hooks/use-active-league";
import { useAnnouncer } from "@/hooks/use-announcer";
import { useSessionAnnouncer } from "@/hooks/use-session-announcer";
import { useSessionRealtime } from "@/hooks/use-session-realtime";
import { useTheme } from "@/hooks/use-theme";
import { trpcClient, useTRPC } from "@/lib/trpc";

function SessionViewSkeleton() {
	return (
		<View style={styles.skeletonCard}>
			<View style={styles.skeletonRow}>
				<Skeleton width={80} height={14} />
				<Skeleton width={64} height={26} radius={7} />
			</View>
			<View style={styles.skeletonScoreboard}>
				<View style={styles.skeletonScoreCol}>
					<Skeleton width="40%" height={9} />
					<Skeleton width={36} height={22} />
				</View>
				<View style={styles.skeletonScoreCol}>
					<Skeleton width="40%" height={9} />
					<Skeleton width={36} height={22} />
				</View>
			</View>
			<View style={styles.skeletonRosters}>
				<Skeleton width="48%" height={110} radius={10} />
				<Skeleton width="48%" height={110} radius={10} />
			</View>
			<Skeleton width="100%" height={40} radius={8} />
		</View>
	);
}

const STANDING_TABS = [
	{ value: "players", label: "Standings" },
	{ value: "teams", label: "Team Standings" },
] as const;

export function SessionView({ sessionId, seasonSlug }: { sessionId: string; seasonSlug: string }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { activeLeague } = useActiveLeague();
	const theme = useTheme();
	const { enabled: announcerEnabled, setEnabled: setAnnouncerEnabled } = useAnnouncer();

	const sessionQuery = useQuery(trpc.session.getById.queryOptions({ sessionId }));
	const session = sessionQuery.data as GameSession | undefined;

	useSessionAnnouncer({ session, enabled: announcerEnabled });

	const [showSettings, setShowSettings] = useState(false);
	const [showAddPlayer, setShowAddPlayer] = useState(false);
	const [standingTab, setStandingTab] = useState<"players" | "teams">("players");

	const handleRemoteEnd = useCallback(() => {
		queryClient.invalidateQueries({
			queryKey: trpc.session.getActive.queryKey({ seasonSlug }),
		});
		queryClient.invalidateQueries({
			queryKey: trpc.session.listEnded.queryKey({ seasonSlug, limit: 10 }),
		});
		if (router.canGoBack()) router.back();
		else router.replace({ pathname: "/seasons/[seasonSlug]", params: { seasonSlug } });
	}, [queryClient, seasonSlug, trpc]);

	useSessionRealtime({
		leagueSlug: activeLeague?.slug,
		seasonSlug,
		sessionId,
		onSessionEnd: handleRemoteEnd,
	});

	const endSession = () => {
		Alert.alert(
			"End this session?",
			"The session will be closed and a summary will be generated.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "End Session",
					style: "destructive",
					onPress: async () => {
						await trpcClient.session.end.mutate({ sessionId });
						queryClient.invalidateQueries({
							queryKey: trpc.session.getActive.queryKey({ seasonSlug }),
						});
						queryClient.invalidateQueries({
							queryKey: trpc.session.listEnded.queryKey({ seasonSlug, limit: 10 }),
						});
						router.replace({
							pathname: "/seasons/[seasonSlug]/session/[sessionId]/summary",
							params: { seasonSlug, sessionId },
						});
					},
				},
			]
		);
	};

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={[]} style={styles.safeArea}>
				<Stack.Screen
					options={{
						title: "Session",
						headerRight: session
							? () => (
									<HeaderActions>
										<HeaderIconButton
											icon={
												announcerEnabled
													? { ios: "speaker.wave.2.fill", android: "volume_up", web: "volume_up" }
													: { ios: "speaker.slash.fill", android: "volume_off", web: "volume_off" }
											}
											label={announcerEnabled ? "Announcer on" : "Announcer off"}
											tint={announcerEnabled ? theme.primary : theme.text}
											onPress={() => setAnnouncerEnabled(!announcerEnabled)}
										/>
										<HeaderIconButton
											icon={{ ios: "person.badge.plus", android: "person_add", web: "person_add" }}
											label="Add player"
											onPress={() => setShowAddPlayer(true)}
										/>
										<HeaderIconButton
											icon={{ ios: "gearshape", android: "settings", web: "settings" }}
											label="Session settings"
											onPress={() => setShowSettings(true)}
										/>
										<HeaderPillButton label="End" tone="destructive" onPress={endSession} />
									</HeaderActions>
								)
							: undefined,
					}}
				/>

				{sessionQuery.isPending ? (
					<SessionViewSkeleton />
				) : !session ? (
					<View style={styles.emptyBox}>
						<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
							Session not found.
						</ThemedText>
						<Pressable onPress={() => router.back()} hitSlop={8}>
							<ThemedText type="small" themeColor="primary">
								Go back
							</ThemedText>
						</Pressable>
					</View>
				) : session.players.length === 0 ? (
					<View style={styles.emptyBox}>
						<ThemedText type="smallBold">No players in this session</ThemedText>
						<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
							Add players to start playing matches.
						</ThemedText>
						<Pressable
							onPress={() => setShowAddPlayer(true)}
							hitSlop={8}
							accessibilityRole="button"
						>
							<ThemedText type="small" themeColor="primary">
								Add Player
							</ThemedText>
						</Pressable>
					</View>
				) : (
					<NextMatchTab
						session={session}
						sessionId={sessionId}
						seasonSlug={seasonSlug}
						refresh={() => sessionQuery.refetch()}
						footer={
							<SectionCard
								title={
									<SegmentedControl
										options={STANDING_TABS}
										value={standingTab}
										onChange={setStandingTab}
									/>
								}
							>
								{standingTab === "teams" ? (
									<SessionTeamStandings seasonSlug={seasonSlug} sessionPlayers={session.players} />
								) : (
									<SessionPlayerStandings
										seasonSlug={seasonSlug}
										sessionPlayers={session.players}
									/>
								)}
							</SectionCard>
						}
					/>
				)}

				{session ? (
					<SessionConfigModal
						mode="edit"
						isOpen={showSettings}
						onClose={() => setShowSettings(false)}
						seasonSlug={seasonSlug}
						session={session}
					/>
				) : null}
				<AddPlayerModal
					isOpen={showAddPlayer}
					onClose={() => setShowAddPlayer(false)}
					sessionId={sessionId}
					seasonSlug={seasonSlug}
				/>
			</SafeAreaView>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, flexDirection: "row", justifyContent: "center" },
	safeArea: {
		flex: 1,
		maxWidth: MaxContentWidth,
		paddingHorizontal: Spacing.three,
		paddingTop: Spacing.three,
	},
	empty: { textAlign: "center" },
	emptyBox: { alignItems: "center", gap: Spacing.three, marginTop: Spacing.five },
	skeletonCard: { gap: Spacing.three, padding: Spacing.three },
	skeletonRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	skeletonScoreboard: { flexDirection: "row", alignItems: "center", gap: Spacing.three },
	skeletonScoreCol: { flex: 1, alignItems: "center", gap: Spacing.one },
	skeletonRosters: { flexDirection: "row", justifyContent: "space-between" },
});
