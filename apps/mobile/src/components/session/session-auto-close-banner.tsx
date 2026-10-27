import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import {
	getSessionAutoCloseRemainingMs,
	SESSION_AUTO_CLOSE_WARNING_MS,
} from "@coding-cowboys/scorebrawl-core/session";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { trpcClient, useTRPC } from "@/lib/trpc";

const COUNTDOWN_TICK_MS = 15_000;
const SECOND_TICK_MS = 1_000;
const SECOND_COUNTDOWN_THRESHOLD_MS = 60_000;
const EXPIRY_REFRESH_MS = 5_000;

interface SessionAutoCloseBannerProps {
	sessionId: string;
	seasonSlug: string;
	autoEndsAt: Date | null;
	style?: StyleProp<ViewStyle>;
}

function formatRemaining(remainingMs: number) {
	if (remainingMs >= SECOND_COUNTDOWN_THRESHOLD_MS) {
		const minutesLeft = Math.ceil(remainingMs / 60_000);
		return minutesLeft === 1 ? "1 minute" : `${minutesLeft} minutes`;
	}

	const secondsLeft = Math.max(0, Math.ceil(remainingMs / 1_000));
	return secondsLeft === 1 ? "1 second" : `${secondsLeft} seconds`;
}

export function SessionAutoCloseBanner({
	sessionId,
	seasonSlug,
	autoEndsAt,
	style,
}: SessionAutoCloseBannerProps) {
	const theme = useTheme();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [now, setNow] = useState(() => Date.now());

	const remainingMs = getSessionAutoCloseRemainingMs(autoEndsAt, now);
	const isInFinalMinute = remainingMs !== null && remainingMs <= SECOND_COUNTDOWN_THRESHOLD_MS;
	const isExpired = remainingMs !== null && remainingMs <= 0;

	useEffect(() => {
		const interval = setInterval(
			() => setNow(Date.now()),
			isInFinalMinute ? SECOND_TICK_MS : COUNTDOWN_TICK_MS
		);
		return () => clearInterval(interval);
	}, [isInFinalMinute]);

	useEffect(() => {
		if (!isExpired) return;

		const refresh = () => {
			queryClient.invalidateQueries({ queryKey: trpc.session.getById.queryKey({ sessionId }) });
			queryClient.invalidateQueries({ queryKey: trpc.session.getActive.queryKey({ seasonSlug }) });
		};

		refresh();
		const interval = setInterval(refresh, EXPIRY_REFRESH_MS);
		return () => clearInterval(interval);
	}, [isExpired, queryClient, sessionId, seasonSlug, trpc]);

	const extendSession = useMutation({
		mutationFn: () => trpcClient.session.extend.mutate({ sessionId }),
		onSuccess: () => {
			setNow(Date.now());
			queryClient.invalidateQueries({ queryKey: trpc.session.getById.queryKey({ sessionId }) });
			queryClient.invalidateQueries({ queryKey: trpc.session.getActive.queryKey({ seasonSlug }) });
		},
		onError: () => Alert.alert("Couldn't extend session", "Please try again."),
	});

	if (remainingMs === null || remainingMs > SESSION_AUTO_CLOSE_WARNING_MS) return null;

	return (
		<View
			accessibilityRole="alert"
			style={[
				styles.banner,
				{ backgroundColor: theme.glowAmberBackground, borderBottomColor: theme.glowAmberBorder },
				style,
			]}
		>
			<View style={styles.message}>
				<SymbolView
					name={{ ios: "timer", android: "timer", web: "timer" }}
					size={14}
					tintColor={theme.glowAmberText}
				/>
				<ThemedText type="small" style={[styles.text, { color: theme.glowAmberText }]}>
					{isExpired ? (
						"Closing session…"
					) : (
						<>
							Session auto closes in{" "}
							<ThemedText type="smallBold" style={{ color: theme.glowAmberText }}>
								{formatRemaining(remainingMs)}
							</ThemedText>{" "}
							unless you register a game.
						</>
					)}
				</ThemedText>
			</View>
			{isExpired ? null : (
				<Button
					size="sm"
					variant="outline"
					disabled={extendSession.isPending}
					onPress={() => extendSession.mutate()}
					style={{ borderColor: theme.glowAmberBorder }}
				>
					<ThemedText type="smallBold" style={{ color: theme.glowAmberText }}>
						{extendSession.isPending ? "Extending…" : "Extend by 1 hour"}
					</ThemedText>
				</Button>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	banner: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Spacing.two,
		paddingHorizontal: Spacing.three,
		paddingVertical: Spacing.two,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	message: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		flexGrow: 1,
		flexShrink: 1,
	},
	text: {
		flexShrink: 1,
	},
});
