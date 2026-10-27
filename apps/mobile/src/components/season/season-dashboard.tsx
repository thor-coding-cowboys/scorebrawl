import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";

import { CreateMatchFlow } from "@/components/create-match-flow";
import { DashboardCards } from "@/components/season/dashboard-cards";
import { SeasonCeremony } from "@/components/season/season-ceremony";
import { LatestMatches } from "@/components/latest-matches";
import { HeaderActions, HeaderIconButton, HeaderPillButton } from "@/components/nav/header-buttons";
import { SCORE_TYPE_CONFIG, type ScoreType } from "@/components/score-type-card";
import { SeasonStandings } from "@/components/season-standings";
import { SeasonTeamStandings } from "@/components/season-team-standings";
import { ActiveSessionBanner } from "@/components/session/active-session-banner";
import { SessionConfigModal } from "@/components/session/session-config-modal";
import { SessionHistory } from "@/components/session-history";
import { ThemedText } from "@/components/themed-text";
import { SectionCard } from "@/components/ui/section-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import { formatDate } from "@coding-cowboys/scorebrawl-core/league";
import { useTRPC, type RouterOutput } from "@/lib/trpc";

type Season = RouterOutput["season"]["getBySlug"];

const STANDING_TABS = [
	{ value: "players", label: "Standings" },
	{ value: "teams", label: "Team Standings" },
] as const;

export function SeasonDashboard({ season }: { season: Season }) {
	const trpc = useTRPC();
	const theme = useTheme();
	const queryClient = useQueryClient();
	const seasonSlug = season.slug;
	const [standingTab, setStandingTab] = useState<"players" | "teams">("players");
	const [isCreateMatchOpen, setIsCreateMatchOpen] = useState(false);
	const [isStartSessionOpen, setIsStartSessionOpen] = useState(false);

	const { data: activeMember } = authClient.useActiveMember();
	const role = activeMember?.role;
	const canCreateMatches = role === "owner" || role === "editor" || role === "member";
	const canCreateSeasons = role === "owner" || role === "editor";
	const isLocked = Boolean(season.closed || season.archived);
	const is1vN = season.scoreType === "1-v-n-elo";

	const { data: countInfo } = useQuery(trpc.season.getCountInfo.queryOptions({ seasonSlug }));
	const hasTeams = (countInfo?.teamCount ?? 0) > 0;
	const { data: activeSession } = useQuery(trpc.session.getActive.queryOptions({ seasonSlug }));

	const { refreshing, onRefresh } = usePullToRefresh(() =>
		queryClient.refetchQueries({ type: "active" })
	);

	const scoreConfig = SCORE_TYPE_CONFIG[season.scoreType as ScoreType] ?? SCORE_TYPE_CONFIG.elo;
	const dateRange = `${formatDate(season.startDate)}${season.endDate ? ` — ${formatDate(season.endDate)}` : ""}`;

	const openSession = () => {
		if (activeSession) {
			router.push({
				pathname: "/seasons/[seasonSlug]/session/[sessionId]",
				params: { seasonSlug, sessionId: activeSession.id },
			});
		} else {
			setIsStartSessionOpen(true);
		}
	};

	return (
		<>
			<Stack.Screen
				options={{
					title: season.name,
					headerRight: canCreateMatches
						? () => (
								<HeaderActions>
									{!is1vN && !isLocked ? (
										<HeaderIconButton
											icon={{
												ios: activeSession ? "play.circle.fill" : "play.circle",
												android: "play_circle",
												web: "play_circle",
											}}
											label={activeSession ? "Go to session" : "Start session"}
											tint={activeSession ? theme.glowAmberText : undefined}
											onPress={openSession}
										/>
									) : null}
									<HeaderPillButton
										icon={{ ios: "plus", android: "add", web: "add" }}
										label="Match"
										tone="glow"
										disabled={isLocked}
										onPress={() => setIsCreateMatchOpen(true)}
									/>
								</HeaderActions>
							)
						: undefined,
				}}
			/>
			<ScrollView
				contentContainerStyle={styles.scroll}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
			>
				<ActiveSessionBanner seasonSlug={seasonSlug} />
				<View style={styles.body}>
					<View style={styles.meta}>
						<View style={[styles.metaDot, { backgroundColor: scoreConfig.color }]} />
						<ThemedText type="small" themeColor="mutedForeground" numberOfLines={1}>
							{scoreConfig.label} · {dateRange}
							{isLocked ? " · Locked" : ""}
						</ThemedText>
					</View>

					{season.closed ? (
						<SeasonCeremony seasonSlug={seasonSlug} canStartNextSeason={canCreateSeasons} />
					) : null}

					<DashboardCards seasonSlug={seasonSlug} />

					<SectionCard
						title={
							hasTeams ? (
								<SegmentedControl
									options={STANDING_TABS}
									value={standingTab}
									onChange={setStandingTab}
								/>
							) : (
								"Standings"
							)
						}
					>
						{hasTeams && standingTab === "teams" ? (
							<SeasonTeamStandings seasonSlug={seasonSlug} />
						) : (
							<SeasonStandings seasonSlug={seasonSlug} />
						)}
					</SectionCard>

					<SectionCard
						title="Latest Matches"
						right={
							<Pressable
								accessibilityRole="link"
								hitSlop={8}
								onPress={() =>
									router.push({
										pathname: "/seasons/[seasonSlug]/matches",
										params: { seasonSlug },
									})
								}
								style={({ pressed }) => pressed && styles.pressed}
							>
								<ThemedText type="small" style={{ color: theme.glowBlueText }}>
									View all
								</ThemedText>
							</Pressable>
						}
					>
						<LatestMatches seasonSlug={seasonSlug} season={season} limit={5} />
					</SectionCard>

					{!is1vN ? (
						<SectionCard title="Session History">
							<SessionHistory seasonSlug={seasonSlug} />
						</SectionCard>
					) : null}
				</View>
			</ScrollView>

			{canCreateMatches ? (
				<CreateMatchFlow
					isOpen={isCreateMatchOpen}
					onClose={() => setIsCreateMatchOpen(false)}
					seasonSlug={seasonSlug}
				/>
			) : null}
			{!is1vN ? (
				<SessionConfigModal
					mode="create"
					isOpen={isStartSessionOpen}
					onClose={() => setIsStartSessionOpen(false)}
					seasonSlug={seasonSlug}
				/>
			) : null}
		</>
	);
}

const styles = StyleSheet.create({
	scroll: {
		width: "100%",
		maxWidth: MaxContentWidth,
		alignSelf: "center",
		paddingBottom: Spacing.five,
	},
	body: {
		paddingHorizontal: Spacing.three,
		gap: Spacing.three,
	},
	meta: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingTop: Spacing.three,
	},
	metaDot: {
		width: 8,
		height: 8,
	},
	pressed: {
		opacity: 0.6,
	},
});
