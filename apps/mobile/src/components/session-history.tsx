import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { SkeletonListRow } from "@/components/ui/skeleton-rows";
import { StaticList } from "@/components/ui/static-list";
import { Spacing } from "@/constants/theme";
import type { RouterOutput } from "@/lib/trpc";
import { useTRPC } from "@/lib/trpc";
import { formatDuration, rotationLabel } from "@coding-cowboys/scorebrawl-core/presentation";

type EndedSession = RouterOutput["session"]["listEnded"][number];

function formatDate(value: Date): string {
	return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
	const endedQuery = useQuery(trpc.session.listEnded.queryOptions({ seasonSlug, limit: 10 }));

	return (
		<StaticList
			data={endedQuery.data ?? []}
			keyExtractor={(item) => item.id}
			renderItem={({ item }) => <SessionRow session={item} seasonSlug={seasonSlug} />}
			ItemSeparatorComponent={Separator}
			ListEmptyComponent={
				endedQuery.isPending ? (
					<View>
						{Array.from({ length: 3 }).map((_, i) => (
							<SkeletonListRow key={i} avatarSize={null} />
						))}
					</View>
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
		marginVertical: Spacing.three,
	},
	emptyBox: {
		alignItems: "center",
		gap: Spacing.three,
	},
});
