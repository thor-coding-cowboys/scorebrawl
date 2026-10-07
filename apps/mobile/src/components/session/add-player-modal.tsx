import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { SkeletonListRow } from "@/components/ui/skeleton-rows";
import { Fonts, Spacing } from "@/constants/theme";
import { getAvatarUri } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { trpcClient, useTRPC } from "@/lib/trpc";

export function AddPlayerModal({
	isOpen,
	onClose,
	sessionId,
	seasonSlug,
}: {
	isOpen: boolean;
	onClose: () => void;
	sessionId: string;
	seasonSlug: string;
}) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const [search, setSearch] = useState("");
	const [addingId, setAddingId] = useState<string | null>(null);
	const [error, setError] = useState("");

	const sessionQuery = useQuery({
		...trpc.session.getById.queryOptions({ sessionId }),
		enabled: isOpen,
	});
	const standingQuery = useQuery({
		...trpc.seasonPlayer.getStanding.queryOptions({ seasonSlug }),
		enabled: isOpen,
	});

	const existing = useMemo(
		() => new Set((sessionQuery.data?.players ?? []).map((p) => p.seasonPlayerId)),
		[sessionQuery.data]
	);

	const available = useMemo(() => {
		const all = standingQuery.data ?? [];
		const eligible = all.filter((p) => !existing.has(p.id));
		const q = search.trim().toLowerCase();
		return q ? eligible.filter((p) => p.name.toLowerCase().includes(q)) : eligible;
	}, [standingQuery.data, existing, search]);

	const addPlayer = async (seasonPlayerId: string) => {
		setAddingId(seasonPlayerId);
		setError("");
		try {
			await trpcClient.session.addPlayer.mutate({ sessionId, seasonPlayerId });
			queryClient.invalidateQueries({ queryKey: trpc.session.getById.queryKey({ sessionId }) });
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to add player");
		} finally {
			setAddingId(null);
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
						<ThemedText type="subtitle">Add Player</ThemedText>
						<ModalCloseButton onPress={onClose} />
					</View>

					<View style={[styles.searchRow, { borderColor: theme.border }]}>
						<SymbolView
							name={{ ios: "magnifyingglass", android: "search", web: "search" }}
							size={15}
							tintColor={theme.textSecondary}
						/>
						<TextInput
							value={search}
							onChangeText={setSearch}
							placeholder="Search players..."
							placeholderTextColor={theme.mutedForeground}
							style={[styles.searchInput, { color: theme.text }]}
						/>
					</View>

					{error ? (
						<ThemedText type="small" style={{ color: theme.destructive }}>
							{error}
						</ThemedText>
					) : null}

					<ScrollView style={styles.list}>
						{standingQuery.isPending ? (
							<View>
								{Array.from({ length: 6 }).map((_, i) => (
									<SkeletonListRow key={i} avatarSize={26} />
								))}
							</View>
						) : available.length === 0 ? (
							<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
								All season players are already in the session.
							</ThemedText>
						) : (
							available.map((p) => (
								<Pressable
									key={p.id}
									onPress={() => addPlayer(p.id)}
									disabled={addingId !== null}
									style={[styles.row, { borderBottomColor: theme.border }]}
								>
									<Avatar name={p.name} image={getAvatarUri(p.image)} size={26} />
									<View style={styles.rowInfo}>
										<ThemedText type="small" numberOfLines={1}>
											{p.name}
										</ThemedText>
										<ThemedText type="small" themeColor="textSecondary">
											{p.score}
										</ThemedText>
									</View>
									{addingId === p.id ? (
										<ThemedText type="small" themeColor="textSecondary">
											Adding…
										</ThemedText>
									) : null}
								</Pressable>
							))
						)}
					</ScrollView>

					<Button variant="outline" onPress={onClose}>
						Done
					</Button>
				</View>
			</ThemedView>
		</Modal>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	content: { flex: 1, paddingHorizontal: Spacing.four },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingBottom: Spacing.three,
	},
	searchRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 8,
		paddingHorizontal: Spacing.three,
		paddingVertical: Spacing.two,
		marginBottom: Spacing.two,
	},
	searchInput: { flex: 1, fontFamily: Fonts.sans, fontSize: 15, padding: 0 },
	list: { flex: 1 },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		paddingVertical: Spacing.two,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	rowInfo: { flex: 1, gap: 1 },
	empty: { textAlign: "center", marginTop: Spacing.four },
});
