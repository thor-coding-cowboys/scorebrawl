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

import { rotationLabel } from "@coding-cowboys/scorebrawl-core/presentation";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useTRPC } from "@/lib/trpc";

export function ActiveSessionBanner({ seasonSlug }: { seasonSlug: string }) {
	const trpc = useTRPC();
	const theme = useTheme();
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
			style={({ pressed }) => [
				styles.banner,
				{ backgroundColor: theme.glowAmberBackground, borderBottomColor: theme.glowAmberBorder },
				pressed && { opacity: 0.85 },
			]}
		>
			<Animated.View style={[styles.liveDot, { backgroundColor: theme.glowAmberText }, dotStyle]} />
			<View style={styles.info}>
				<ThemedText type="smallBold" style={[styles.title, { color: theme.glowAmberText }]}>
					Session in progress
				</ThemedText>
				<ThemedText
					type="small"
					style={[styles.sub, { color: theme.glowAmberText }]}
					numberOfLines={1}
				>
					{rotationLabel(session.rotationMode)} · {session.players.length} players
				</ThemedText>
			</View>
			<View style={[styles.cta, { borderColor: theme.glowAmberBorder }]}>
				<SymbolView
					name={{ ios: "play.fill", android: "play_arrow", web: "play_arrow" }}
					size={11}
					tintColor={theme.glowAmberText}
				/>
				<ThemedText type="smallBold" style={[styles.ctaLabel, { color: theme.glowAmberText }]}>
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
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	liveDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	info: {
		flex: 1,
	},
	title: {
		fontSize: 13,
		lineHeight: 18,
	},
	sub: {
		opacity: 0.85,
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
	},
	ctaLabel: {
		fontSize: 12,
		lineHeight: 16,
	},
});
