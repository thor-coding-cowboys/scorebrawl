import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { Spacing } from "@/constants/theme";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useTheme } from "@/hooks/use-theme";
import type { RouterOutput } from "@/lib/trpc";
import { useTRPC } from "@/lib/trpc";

type EndedSession = RouterOutput["session"]["listEnded"][number];
type ActiveSession = NonNullable<RouterOutput["session"]["getActive"]>;

function formatDuration(start: Date, end: Date | null): string {
	if (!end) return "In progress";
	const minutes = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 60000);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const remaining = minutes % 60;
	return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

function rotationLabel(mode: string): string {
	if (mode === "winner-stays") return "Winner Stays";
	if (mode === "manual") return "Manual";
	return mode;
}

function formatDate(value: Date): string {
	return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ActiveSessionCard({
	session,
	seasonSlug,
}: {
	session: ActiveSession;
	seasonSlug: string;
}) {
	const theme = useTheme();
	return (
		<Pressable
			onPress={() =>
				router.push({
					pathname: "/seasons/[seasonSlug]/session/[sessionId]",
					params: { seasonSlug, sessionId: session.id, view: "next" },
				})
			}
			style={({ pressed }) => [
				styles.activeCard,
				{
					borderColor: theme.glowBlueBorder,
					backgroundColor: theme.glowBlueBg,
					opacity: pressed ? 0.85 : 1,
				},
			]}
		>
			<View style={styles.activeHeader}>
				<View style={styles.liveRow}>
					<View style={styles.liveDot} />
					<ThemedText type="smallBold" style={{ color: theme.glowBlueText }}>
						Active session
					</ThemedText>
				</View>
				<ThemedText type="small" themeColor="textSecondary">
					{rotationLabel(session.rotationMode)}
				</ThemedText>
			</View>
			<ThemedText type="smallBold" style={styles.activeDate}>
				{formatDate(session.createdAt)}
			</ThemedText>
			<ThemedText type="small" themeColor="textSecondary">
				In progress · {session.players.length} players · {session.teamSize}v{session.teamSize}
			</ThemedText>
		</Pressable>
	);
}

function SessionRow({ session, seasonSlug }: { session: EndedSession; seasonSlug: string }) {
	return (
		<Pressable
			accessibilityRole="button"
			onPress={() =>
				router.push({
					pathname: "/seasons/[seasonSlug]/session/[sessionId]/summary",
					params: { seasonSlug, sessionId: session.id },
				})
			}
			style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
		>
			<View style={styles.rowInfo}>
				<ThemedText style={styles.rowDate}>{formatDate(session.createdAt)}</ThemedText>
				<ThemedText type="small" themeColor="textSecondary">
					{formatDuration(session.createdAt, session.endedAt)} · {session.totalMatches} matches ·{" "}
					{session.playerCount} players
				</ThemedText>
			</View>
			<ThemedText type="small" themeColor="textSecondary">
				{rotationLabel(session.rotationMode)}
			</ThemedText>
		</Pressable>
	);
}

const Separator = () => <View style={styles.separator} />;

export function SessionHistory({ seasonSlug }: { seasonSlug: string }) {
	const trpc = useTRPC();
	const activeQuery = useQuery(trpc.session.getActive.queryOptions({ seasonSlug }));
	const endedQuery = useQuery(trpc.session.listEnded.queryOptions({ seasonSlug, limit: 10 }));
	const { refreshing, onRefresh } = usePullToRefresh(() =>
		Promise.all([activeQuery.refetch(), endedQuery.refetch()])
	);

	const active = activeQuery.data ?? null;
	const sessions = endedQuery.data ?? [];

	return (
		<FlatList
			style={styles.flatList}
			data={sessions}
			keyExtractor={(item) => item.id}
			renderItem={({ item }) => <SessionRow session={item} seasonSlug={seasonSlug} />}
			ItemSeparatorComponent={Separator}
			contentContainerStyle={styles.list}
			refreshing={refreshing}
			onRefresh={onRefresh}
			ListHeaderComponent={
				active ? (
					<View style={styles.header}>
						<ActiveSessionCard session={active} seasonSlug={seasonSlug} />
						{sessions.length > 0 ? (
							<ThemedText type="smallBold" style={styles.historyLabel}>
								History
							</ThemedText>
						) : null}
					</View>
				) : null
			}
			ListEmptyComponent={
				active ? null : endedQuery.isPending ? (
					<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
						Loading sessions…
					</ThemedText>
				) : endedQuery.isError && endedQuery.data === undefined ? (
					<View style={styles.emptyBox}>
						<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
							Couldn't load sessions
						</ThemedText>
						<Button variant="outline" onPress={() => endedQuery.refetch()}>
							Retry
						</Button>
					</View>
				) : (
					<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
						No sessions yet
					</ThemedText>
				)
			}
		/>
	);
}

const styles = StyleSheet.create({
	flatList: {
		flex: 1,
	},
	list: {
		paddingBottom: Spacing.four,
	},
	header: {
		gap: Spacing.two,
	},
	historyLabel: {
		marginTop: Spacing.two,
	},
	activeCard: {
		borderWidth: 1,
		borderRadius: 10,
		padding: Spacing.three,
		gap: Spacing.one,
	},
	activeHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	liveRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
	},
	liveDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: "#22c55e",
	},
	activeDate: {
		fontSize: 16,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Spacing.two,
		paddingVertical: Spacing.three,
	},
	rowInfo: {
		flex: 1,
		gap: 2,
	},
	rowDate: {
		fontWeight: "400",
	},
	separator: {
		height: StyleSheet.hairlineWidth,
		backgroundColor: "rgba(128,128,128,0.25)",
	},
	empty: {
		textAlign: "center",
		marginTop: Spacing.four,
	},
	emptyBox: {
		alignItems: "center",
		gap: Spacing.three,
	},
});
