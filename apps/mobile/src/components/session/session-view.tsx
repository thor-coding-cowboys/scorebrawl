import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MobileHeader } from "@/components/mobile-header";
import { NextMatchTab } from "@/components/session/next-match-tab";
import { SessionPlayerStandings, SessionTeamStandings } from "@/components/session/standings-tab";
import type { GameSession } from "@/components/session/types";
import { rotationLabel } from "@/components/session/utils";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { trpcClient, useTRPC } from "@/lib/trpc";

export function SessionView({
	sessionId,
	seasonSlug,
	view,
}: {
	sessionId: string;
	seasonSlug: string;
	view: string;
}) {
	const theme = useTheme();
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const sessionQuery = useQuery(trpc.session.getById.queryOptions({ sessionId }));
	const session = sessionQuery.data as GameSession | undefined;

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
				<MobileHeader
					onBack={() => router.back()}
					title="Session"
					eyebrow={session ? rotationLabel(session.rotationMode) : undefined}
					right={
						session ? (
							<Pressable onPress={endSession} hitSlop={8}>
								<ThemedText type="smallBold" style={{ color: theme.destructive }}>
									End Session
								</ThemedText>
							</Pressable>
						) : undefined
					}
				/>

				{sessionQuery.isPending ? (
					<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
						Loading session…
					</ThemedText>
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
				) : view === "standings" ? (
					<SessionPlayerStandings seasonSlug={seasonSlug} sessionPlayers={session.players} />
				) : view === "teams" ? (
					<SessionTeamStandings seasonSlug={seasonSlug} sessionPlayers={session.players} />
				) : (
					<NextMatchTab
						session={session}
						sessionId={sessionId}
						seasonSlug={seasonSlug}
						refresh={() => sessionQuery.refetch()}
					/>
				)}
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
		paddingBottom: Spacing.three,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: Spacing.three,
	},
	headerText: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
	empty: { textAlign: "center", marginTop: Spacing.five },
	emptyBox: { alignItems: "center", gap: Spacing.three },
});
