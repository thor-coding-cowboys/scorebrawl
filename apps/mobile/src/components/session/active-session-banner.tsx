import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";

import { rotationLabel } from "@/components/session/utils";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTRPC } from "@/lib/trpc";

const AMBER = "#f59e0b";

export function ActiveSessionBanner({ seasonSlug }: { seasonSlug: string }) {
	const trpc = useTRPC();
	const { data: session } = useQuery(trpc.session.getActive.queryOptions({ seasonSlug }));
	const pulse = useSharedValue(1);

	useEffect(() => {
		pulse.value = withRepeat(withTiming(0.35, { duration: 900 }), -1, true);
	}, [pulse]);

	const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

	if (!session || session.status !== "active") return null;

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel="Go to session"
			onPress={() =>
				router.push({
					pathname: "/seasons/[seasonSlug]/session/[sessionId]",
					params: { seasonSlug, sessionId: session.id },
				})
			}
			style={({ pressed }) => [styles.banner, pressed && { opacity: 0.85 }]}
		>
			<Animated.View style={[styles.liveDot, dotStyle]} />
			<View style={styles.info}>
				<ThemedText type="smallBold" style={styles.title}>
					Session in progress
				</ThemedText>
				<ThemedText type="small" style={styles.sub} numberOfLines={1}>
					{rotationLabel(session.rotationMode)} · {session.players.length} players
				</ThemedText>
			</View>
			<View style={styles.cta}>
				<SymbolView
					name={{ ios: "play.fill", android: "play_arrow", web: "play_arrow" }}
					size={11}
					tintColor={AMBER}
				/>
				<ThemedText type="smallBold" style={styles.ctaLabel}>
					Go to Session
				</ThemedText>
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	banner: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingHorizontal: Spacing.three,
		paddingVertical: Spacing.two,
		backgroundColor: "rgba(245, 158, 11, 0.10)",
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "rgba(245, 158, 11, 0.25)",
	},
	liveDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
		backgroundColor: AMBER,
	},
	info: {
		flex: 1,
	},
	title: {
		color: AMBER,
		fontSize: 13,
		lineHeight: 18,
	},
	sub: {
		color: "rgba(245, 158, 11, 0.8)",
		fontSize: 12,
		lineHeight: 16,
	},
	cta: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		paddingHorizontal: 10,
		height: 30,
		borderWidth: 1,
		borderColor: "rgba(245, 158, 11, 0.35)",
	},
	ctaLabel: {
		color: AMBER,
		fontSize: 12,
		lineHeight: 16,
	},
});
