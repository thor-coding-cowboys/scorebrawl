import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { Spacing } from "@/constants/theme";
import { getAvatarUri } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { trpcClient, useTRPC } from "@/lib/trpc";

interface RecordGameModalProps {
	isOpen: boolean;
	onClose: () => void;
	seasonSlug: string;
}

export function RecordGameModal({ isOpen, onClose, seasonSlug }: RecordGameModalProps) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [playerIds, setPlayerIds] = useState<string[]>([]);
	const [winnerId, setWinnerId] = useState("");
	const [keepOpen, setKeepOpen] = useState(false);
	const [keepPlayers, setKeepPlayers] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState("");

	const standingQuery = useQuery(trpc.seasonPlayer.getStanding.queryOptions({ seasonSlug }));
	const seasonPlayers = standingQuery.data ?? [];

	useEffect(() => {
		if (isOpen) {
			setPlayerIds([]);
			setWinnerId("");
			setKeepOpen(false);
			setKeepPlayers(false);
			setError("");
		}
	}, [isOpen]);

	const togglePlayer = (id: string) => {
		setPlayerIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
		setWinnerId((prev) => (prev === id ? "" : prev));
	};

	const selectedPlayers = seasonPlayers.filter((p) => playerIds.includes(p.id));
	const canSubmit = selectedPlayers.length >= 2 && !!winnerId && !isSubmitting;

	const submit = async () => {
		if (!canSubmit) return;
		setIsSubmitting(true);
		setError("");
		try {
			const loserIds = playerIds.filter((id) => id !== winnerId);
			await trpcClient.match.createOneVn.mutate({ seasonSlug, winnerId, loserIds });
			queryClient.invalidateQueries({
				queryKey: trpc.match.getAll.queryKey({ seasonSlug, limit: 30, offset: 0 }),
			});
			queryClient.invalidateQueries({
				queryKey: trpc.match.getAll.queryKey({ seasonSlug, limit: 1, offset: 0 }),
			});
			queryClient.invalidateQueries({
				queryKey: trpc.seasonPlayer.getStanding.queryKey({ seasonSlug }),
			});
			queryClient.invalidateQueries({
				queryKey: trpc.seasonTeam.getStanding.queryKey({ seasonSlug }),
			});
			if (keepOpen) {
				setWinnerId("");
				if (!keepPlayers) setPlayerIds([]);
			} else {
				onClose();
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to record game");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal visible={isOpen} animationType="slide" onRequestClose={onClose}>
			<ThemedView style={styles.flex}>
				<View
					style={[
						styles.content,
						{ paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + Spacing.two },
					]}
				>
					<View style={styles.header}>
						<View style={styles.titleRow}>
							<View style={[styles.accent, { backgroundColor: theme.primary }]} />
							<ThemedText type="subtitle">Record Game</ThemedText>
						</View>
						<ModalCloseButton onPress={onClose} />
					</View>

					<ScrollView style={styles.scroll} contentContainerStyle={styles.form}>
						<View style={styles.section}>
							<ThemedText type="small" themeColor="textSecondary">
								PLAYERS ({playerIds.length})
							</ThemedText>
							<View style={styles.chips}>
								{seasonPlayers.map((p) => {
									const selected = playerIds.includes(p.id);
									return (
										<Pressable
											key={p.id}
											onPress={() => togglePlayer(p.id)}
											style={[
												styles.chip,
												{ borderColor: selected ? theme.primary : theme.border },
												selected && { backgroundColor: `${theme.primary}1a` },
											]}
										>
											<Avatar name={p.name} image={getAvatarUri(p.image)} size={20} />
											<ThemedText type="small" numberOfLines={1}>
												{p.name}
											</ThemedText>
										</Pressable>
									);
								})}
							</View>
						</View>

						<View style={styles.section}>
							<ThemedText type="small" themeColor="textSecondary">
								WINNER
							</ThemedText>
							<View style={styles.winnerList}>
								{selectedPlayers.length === 0 ? (
									<ThemedText type="small" themeColor="textSecondary">
										Select players first
									</ThemedText>
								) : (
									selectedPlayers.map((p) => {
										const isWinner = winnerId === p.id;
										return (
											<Pressable
												key={p.id}
												onPress={() => setWinnerId(p.id)}
												style={[
													styles.winnerRow,
													{ borderColor: isWinner ? theme.primary : theme.border },
													isWinner && { backgroundColor: `${theme.primary}1a` },
												]}
											>
												<View
													style={[
														styles.radio,
														{ borderColor: isWinner ? theme.primary : theme.textSecondary },
													]}
												>
													{isWinner ? (
														<View style={[styles.radioDot, { backgroundColor: theme.primary }]} />
													) : null}
												</View>
												<Avatar name={p.name} image={getAvatarUri(p.image)} size={22} />
												<ThemedText type="small" numberOfLines={1}>
													{p.name}
												</ThemedText>
											</Pressable>
										);
									})
								)}
							</View>
						</View>

						<View style={styles.messages}>
							{playerIds.length >= 2 && !winnerId ? <Warning text="Select a winner" /> : null}
							{playerIds.length < 2 ? <Warning text="Select at least 2 players" /> : null}
							{error ? (
								<ThemedText type="small" style={{ color: theme.destructive }}>
									{error}
								</ThemedText>
							) : null}
						</View>
					</ScrollView>

					<View style={[styles.footer, { borderTopColor: theme.border }]}>
						<View style={styles.checks}>
							<CheckRow
								label="Keep open"
								value={keepOpen}
								onToggle={() => setKeepOpen((v) => !v)}
							/>
							<CheckRow
								label="Keep players"
								value={keepPlayers}
								onToggle={() => setKeepPlayers((v) => !v)}
							/>
						</View>
						<View style={styles.actionRow}>
							<Button variant="outline" onPress={onClose} disabled={isSubmitting}>
								Cancel
							</Button>
							<Button
								variant="glow"
								style={styles.submit}
								onPress={submit}
								loading={isSubmitting}
								disabled={!canSubmit}
							>
								Record Game
							</Button>
						</View>
					</View>
				</View>
			</ThemedView>
		</Modal>
	);
}

function CheckRow({
	label,
	value,
	onToggle,
}: {
	label: string;
	value: boolean;
	onToggle: () => void;
}) {
	const theme = useTheme();
	return (
		<Pressable onPress={onToggle} style={styles.checkRow} hitSlop={6}>
			<View
				style={[
					styles.checkbox,
					{ borderColor: value ? theme.glowBlueBorder : theme.border },
					value && { backgroundColor: theme.glowBlueBg },
				]}
			>
				{value ? (
					<SymbolView
						name={{ ios: "checkmark", android: "check", web: "check" }}
						size={11}
						tintColor={theme.glowBlueText}
					/>
				) : null}
			</View>
			<ThemedText type="small">{label}</ThemedText>
		</Pressable>
	);
}

function Warning({ text }: { text: string }) {
	return (
		<View style={styles.warning}>
			<SymbolView
				name={{ ios: "exclamationmark.triangle", android: "warning", web: "warning" }}
				size={13}
				tintColor="#d97706"
			/>
			<ThemedText type="small" style={styles.warningText}>
				{text}
			</ThemedText>
		</View>
	);
}

const styles = StyleSheet.create({
	flex: {
		flex: 1,
	},
	content: {
		flex: 1,
		paddingHorizontal: Spacing.four,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingBottom: Spacing.three,
	},
	titleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
	},
	accent: {
		width: 4,
		height: 20,
		borderRadius: 2,
	},
	scroll: {
		flex: 1,
	},
	form: {
		gap: Spacing.four,
		paddingBottom: Spacing.four,
	},
	section: {
		gap: Spacing.two,
	},
	chips: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.two,
	},
	chip: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.one,
		paddingVertical: Spacing.one,
		paddingHorizontal: Spacing.two,
		borderRadius: 0,
		borderWidth: 1,
		maxWidth: "100%",
	},
	winnerList: {
		gap: Spacing.two,
	},
	winnerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingVertical: Spacing.two,
		paddingHorizontal: Spacing.two,
		borderRadius: 0,
		borderWidth: 1,
	},
	radio: {
		width: 18,
		height: 18,
		borderRadius: 9,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
	},
	radioDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	messages: {
		gap: Spacing.one,
		minHeight: 20,
	},
	warning: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.one,
	},
	warningText: {
		flex: 1,
		color: "#d97706",
	},
	footer: {
		gap: Spacing.three,
		paddingTop: Spacing.three,
		borderTopWidth: StyleSheet.hairlineWidth,
	},
	checks: {
		flexDirection: "row",
		gap: Spacing.four,
	},
	checkRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
	},
	checkbox: {
		width: 20,
		height: 20,
		borderRadius: 0,
		borderWidth: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	actionRow: {
		flexDirection: "row",
		gap: Spacing.two,
	},
	submit: {
		flex: 1,
	},
});
