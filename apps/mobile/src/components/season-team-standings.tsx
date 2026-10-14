import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { StandingRow, type StandingItem } from "@/components/standing-row";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { StaticList } from "@/components/ui/static-list";
import { SkeletonStandingRow } from "@/components/ui/skeleton-rows";
import { Spacing } from "@/constants/theme";
import { getAvatarUri } from "@/hooks/use-user-avatar";
import { getAuthCookie } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";
import { sortStandings } from "@coding-cowboys/scorebrawl-core/presentation";

const Separator = () => <View style={styles.separator} />;

export function SeasonTeamStandings({ seasonSlug }: { seasonSlug: string }) {
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

	const standingsQuery = useQuery(trpc.seasonTeam.getStanding.queryOptions({ seasonSlug }));
	const standings: StandingItem[] = sortStandings(standingsQuery.data ?? []).map((item) => ({
		id: item.id,
		name: item.name,
		image: getAvatarUri(item.logo),
		score: item.score,
		matchCount: item.matchCount,
		winCount: item.winCount,
		pointDiff: item.pointDiff,
		form: item.form,
	}));

	return (
		<StaticList
			data={standings}
			keyExtractor={(item) => item.id}
			renderItem={({ item }) => <StandingRow item={item} headers={avatarHeaders} />}
			ItemSeparatorComponent={Separator}
			ListEmptyComponent={
				standingsQuery.isPending ? (
					<View>
						{Array.from({ length: 6 }).map((_, i) => (
							<SkeletonStandingRow key={i} />
						))}
					</View>
				) : standingsQuery.isError && standingsQuery.data === undefined ? (
					<View style={styles.emptyBox}>
						<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
							Couldn't load team standings
						</ThemedText>
						<Button variant="outline" onPress={() => standingsQuery.refetch()}>
							Retry
						</Button>
					</View>
				) : (
					<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
						No team standings
					</ThemedText>
				)
			}
		/>
	);
}

const styles = StyleSheet.create({
	separator: {
		height: StyleSheet.hairlineWidth,
		backgroundColor: "rgba(128,128,128,0.25)",
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
