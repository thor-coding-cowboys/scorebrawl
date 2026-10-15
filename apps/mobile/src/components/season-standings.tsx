import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { StandingRow } from "@/components/standing-row";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { StaticList } from "@/components/ui/static-list";
import { SkeletonStandingRow } from "@/components/ui/skeleton-rows";
import { Spacing, SharedColors } from "@/constants/theme";
import { getAuthCookie } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";
import { sortStandings } from "@coding-cowboys/scorebrawl-core/presentation";

const Separator = () => <View style={styles.separator} />;

export function SeasonStandings({ seasonSlug }: { seasonSlug: string }) {
	const trpc = useTRPC();
	const [cookie, setCookie] = useState<string | undefined>();

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

	const standingsQuery = useQuery(trpc.seasonPlayer.getStanding.queryOptions({ seasonSlug }));
	const standings = sortStandings(standingsQuery.data ?? []);

	return (
		<StaticList
			data={standings}
			keyExtractor={(item) => item.id}
			renderItem={({ item }) => {
				const playerId = item.playerId;
				return (
					<StandingRow
						item={item}
						headers={avatarHeaders}
						onPress={
							playerId
								? () => router.push({ pathname: "/players/[playerId]", params: { playerId } })
								: undefined
						}
					/>
				);
			}}
			ItemSeparatorComponent={Separator}
			ListEmptyComponent={
				standingsQuery.isPending ? (
					<View>
						{Array.from({ length: 7 }).map((_, i) => (
							<SkeletonStandingRow key={i} />
						))}
					</View>
				) : standingsQuery.isError && standingsQuery.data === undefined ? (
					<View style={styles.emptyBox}>
						<ThemedText type="small" themeColor="mutedForeground" style={styles.empty}>
							Couldn't load standings
						</ThemedText>
						<Button variant="outline" onPress={() => standingsQuery.refetch()}>
							Retry
						</Button>
					</View>
				) : (
					<ThemedText type="small" themeColor="mutedForeground" style={styles.empty}>
						No matches registered
					</ThemedText>
				)
			}
		/>
	);
}

const styles = StyleSheet.create({
	separator: {
		height: StyleSheet.hairlineWidth,
		backgroundColor: SharedColors.divider,
		marginLeft: 44,
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
