import { useQueryClient } from "@tanstack/react-query";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { useSessionTheme } from "@/components/session/theme";
import type { GameSession, SessionMatch, SessionPlayer } from "@/components/session/types";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { getAvatarUri } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { trpcClient, useTRPC } from "@/lib/trpc";

function getPlayerResultForMatch(
	player: SessionPlayer,
	match: SessionMatch
): "win" | "loss" | "draw" | null {
	if (!match.result) return null;
	const isHome = match.homePlayerIds.includes(player.seasonPlayerId);
	const isAway = match.awayPlayerIds.includes(player.seasonPlayerId);
	if (!isHome && !isAway) return null;
	if (match.result === "draw") return "draw";
	const won = (isHome && match.result === "home") || (isAway && match.result === "away");
	return won ? "win" : "loss";
}

const DOT_COLORS = { win: "#22c55e", loss: "#ef4444", draw: "#eab308" } as const;

function StreakDots({ player, matches }: { player: SessionPlayer; matches: SessionMatch[] }) {
	if (player.consecutiveGames <= 0) return null;
	const recent = matches
		.filter((m) => m.result !== null)
		.sort((a, b) => b.matchNumber - a.matchNumber)
		.slice(0, Math.min(player.consecutiveGames, 8))
		.reverse();

	return (
		<View style={styles.dots}>
			{recent.map((m) => {
				const result = getPlayerResultForMatch(player, m);
				if (!result) return null;
				return <View key={m.id} style={[styles.dot, { backgroundColor: DOT_COLORS[result] }]} />;
			})}
			{player.consecutiveGames > 8 ? (
				<ThemedText type="small" themeColor="textSecondary">
					+{player.consecutiveGames - 8}
				</ThemedText>
			) : null}
		</View>
	);
}

function PlayerRow({
	player,
	matches,
	rank,
	onRemove,
	onRejoin,
	busy,
}: {
	player: SessionPlayer;
	matches: SessionMatch[];
	rank?: number;
	onRemove?: () => void;
	onRejoin?: () => void;
	busy?: boolean;
}) {
	const theme = useTheme();
	return (
		<View style={[styles.playerRow, { borderBottomColor: theme.border }]}>
			{rank !== undefined ? (
				<ThemedText type="small" themeColor="textSecondary" style={styles.rank}>
					{rank}
				</ThemedText>
			) : (
				<View style={styles.rank} />
			)}
			<Avatar name={player.displayName} image={getAvatarUri(player.playerImage)} size={24} />
			<View style={styles.playerInfo}>
				<ThemedText numberOfLines={1} style={styles.playerName}>
					{player.displayName}
				</ThemedText>
			</View>
			<View style={styles.playerMeta}>
				<StreakDots player={player} matches={matches} />
				<ThemedText themeColor="textSecondary" style={styles.games}>
					{player.gamesPlayedThisSession}g
				</ThemedText>
				<ThemedText style={styles.score}>{player.score}</ThemedText>
				{onRejoin ? (
					<Pressable onPress={onRejoin} disabled={busy} hitSlop={8} style={styles.iconButton}>
						<SymbolView
							name={{ ios: "arrow.clockwise", android: "refresh", web: "refresh" }}
							size={14}
							tintColor={theme.textSecondary}
						/>
					</Pressable>
				) : null}
				{onRemove ? (
					<Pressable onPress={onRemove} disabled={busy} hitSlop={8} style={styles.iconButton}>
						<SymbolView
							name={{ ios: "xmark", android: "close", web: "close" }}
							size={14}
							tintColor={theme.textSecondary}
						/>
					</Pressable>
				) : null}
			</View>
		</View>
	);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	const sessionTheme = useSessionTheme();
	return (
		<View>
			<View style={[styles.sectionHeader, { backgroundColor: sessionTheme.mutedBg }]}>
				<ThemedText themeColor="textSecondary" style={styles.sectionTitle}>
					{title}
				</ThemedText>
			</View>
			{children}
		</View>
	);
}

export function QueueList({ session, sessionId }: { session: GameSession; sessionId: string }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [busyId, setBusyId] = useState<string | null>(null);

	const playing = session.players.filter((p) => p.status === "playing");
	const waiting = session.players
		.filter((p) => p.status === "waiting")
		.sort((a, b) => a.queuePosition - b.queuePosition);
	const out = session.players.filter((p) => p.status === "out");
	const hasActiveMatch = session.matches.some((m) => m.result === null);
	const canRemove = session.players.filter((p) => p.status !== "out").length > session.teamSize * 2;

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: trpc.session.getById.queryKey({ sessionId }) });

	const removePlayer = async (sessionPlayerId: string) => {
		setBusyId(sessionPlayerId);
		try {
			await trpcClient.session.removePlayer.mutate({ sessionId, sessionPlayerId });
			invalidate();
		} finally {
			setBusyId(null);
		}
	};

	const rejoinPlayer = async (seasonPlayerId: string) => {
		setBusyId(seasonPlayerId);
		try {
			await trpcClient.session.addPlayer.mutate({ sessionId, seasonPlayerId });
			invalidate();
		} finally {
			setBusyId(null);
		}
	};

	if (session.players.length === 0) {
		return (
			<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
				No players
			</ThemedText>
		);
	}

	return (
		<View style={styles.content}>
			{playing.length > 0 ? (
				<Section title="PLAYING">
					{playing.map((p) => (
						<PlayerRow
							key={p.id}
							player={p}
							matches={session.matches}
							onRemove={!hasActiveMatch && canRemove ? () => removePlayer(p.id) : undefined}
							busy={busyId === p.id}
						/>
					))}
				</Section>
			) : null}
			{waiting.length > 0 ? (
				<Section title="QUEUE">
					{waiting.map((p, i) => (
						<PlayerRow
							key={p.id}
							player={p}
							matches={session.matches}
							rank={i + 1}
							onRemove={canRemove ? () => removePlayer(p.id) : undefined}
							busy={busyId === p.id}
						/>
					))}
				</Section>
			) : null}
			{out.length > 0 ? (
				<Section title="OUT">
					{out.map((p) => (
						<PlayerRow
							key={p.id}
							player={p}
							matches={session.matches}
							onRejoin={() => rejoinPlayer(p.seasonPlayerId)}
							busy={busyId === p.id}
						/>
					))}
				</Section>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	content: {},
	sectionHeader: { paddingHorizontal: 16, paddingVertical: 6 },
	sectionTitle: {
		fontSize: 11,
		lineHeight: 14,
		fontWeight: "400",
		textTransform: "uppercase",
		letterSpacing: 0.6,
	},
	playerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	rank: { width: 16, textAlign: "right", fontSize: 12, lineHeight: 16 },
	playerInfo: { flex: 1 },
	playerName: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
	playerMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
	dots: { flexDirection: "row", alignItems: "center", gap: 2 },
	dot: { width: 6, height: 6, borderRadius: 3 },
	games: { fontSize: 12, lineHeight: 16 },
	score: { fontSize: 14, lineHeight: 20, fontWeight: "400", fontVariant: ["tabular-nums"] },
	iconButton: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
	empty: { textAlign: "center", marginTop: Spacing.four },
});
