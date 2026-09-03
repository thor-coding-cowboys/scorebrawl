import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { CreateLeagueForm } from "@/components/create-league-form";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useActiveLeague } from "@/hooks/use-active-league";
import { useUserAvatar } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";

function LeagueAvatar({ name, logo }: { name: string; logo?: string | null }) {
	const { uri, headers } = useUserAvatar(logo);
	return <Avatar name={name} image={uri} headers={headers} size={28} />;
}

export function LeagueSwitcher() {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const { activeLeague, organizations, switchLeague } = useActiveLeague();
	const [isOpen, setIsOpen] = useState(false);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [switchingId, setSwitchingId] = useState<string | null>(null);
	const createOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const { uri, headers } = useUserAvatar(activeLeague?.logo);

	useEffect(() => {
		return () => {
			if (createOpenTimer.current) {
				clearTimeout(createOpenTimer.current);
			}
		};
	}, []);

	const handleSelect = async (organizationId: string) => {
		if (organizationId === activeLeague?.id) {
			setIsOpen(false);
			return;
		}
		if (switchingId) return;
		setSwitchingId(organizationId);
		const ok = await switchLeague(organizationId);
		setSwitchingId(null);
		if (ok) {
			setIsOpen(false);
		}
	};

	const openCreateForm = () => {
		if (createOpenTimer.current) {
			clearTimeout(createOpenTimer.current);
		}
		setIsOpen(false);
		createOpenTimer.current = setTimeout(() => {
			createOpenTimer.current = null;
			setIsCreateOpen(true);
		}, 350);
	};

	if (!activeLeague) {
		return null;
	}

	return (
		<>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Switch league"
				onPress={() => {
					if (createOpenTimer.current) {
						clearTimeout(createOpenTimer.current);
						createOpenTimer.current = null;
					}
					setIsOpen(true);
				}}
				style={({ pressed }) => [styles.switcher, pressed && { opacity: 0.7 }]}
			>
				<Avatar name={activeLeague.name} image={uri} headers={headers} size={32} />
				<View style={styles.switcherText}>
					<ThemedText type="smallBold" numberOfLines={1}>
						{activeLeague.name}
					</ThemedText>
					<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
						/{activeLeague.slug}
					</ThemedText>
				</View>
				<SymbolView
					name={{ ios: "chevron.up.chevron.down", android: "unfold_more", web: "unfold_more" }}
					size={16}
					tintColor={theme.textSecondary}
				/>
			</Pressable>

			<Modal
				visible={isOpen}
				transparent
				animationType="slide"
				onRequestClose={() => setIsOpen(false)}
			>
				<Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
					<Pressable
						style={[
							styles.sheet,
							{ paddingBottom: insets.bottom + Spacing.four, backgroundColor: theme.background },
						]}
						onPress={(e) => e.stopPropagation()}
					>
						<View style={styles.sheetHandle} />
						<ThemedText type="smallBold" themeColor="textSecondary" style={styles.sheetLabel}>
							Leagues
						</ThemedText>
						<ScrollView style={styles.sheetList}>
							{(organizations ?? []).map((org) => {
								const isActive = org.id === activeLeague.id;
								return (
									<Pressable
										key={org.id}
										accessibilityRole="button"
										accessibilityState={{ selected: isActive }}
										disabled={switchingId !== null}
										onPress={() => handleSelect(org.id)}
										style={({ pressed }) => [
											styles.leagueItem,
											isActive && { backgroundColor: theme.backgroundSelected },
											pressed && { opacity: 0.7 },
										]}
									>
										<LeagueAvatar name={org.name} logo={org.logo} />
										<ThemedText style={styles.leagueName} numberOfLines={1}>
											{org.name}
										</ThemedText>
										{isActive && (
											<SymbolView
												name={{ ios: "checkmark", android: "check", web: "check" }}
												size={16}
												tintColor={theme.primary}
											/>
										)}
									</Pressable>
								);
							})}
						</ScrollView>
						<Pressable
							accessibilityRole="button"
							onPress={openCreateForm}
							style={({ pressed }) => [styles.footerRow, pressed && { opacity: 0.7 }]}
						>
							<SymbolView
								name={{ ios: "plus", android: "add", web: "add" }}
								size={16}
								tintColor={theme.text}
							/>
							<ThemedText type="small">Create league</ThemedText>
						</Pressable>
					</Pressable>
				</Pressable>
			</Modal>
			<CreateLeagueForm isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
		</>
	);
}

const styles = StyleSheet.create({
	switcher: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingVertical: Spacing.two,
		paddingHorizontal: Spacing.two,
		borderRadius: 10,
	},
	switcherText: {
		flex: 1,
	},
	backdrop: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.5)",
		justifyContent: "flex-end",
	},
	sheet: {
		borderTopLeftRadius: 16,
		borderTopRightRadius: 16,
		paddingHorizontal: Spacing.three,
		paddingTop: Spacing.two,
		maxHeight: "70%",
	},
	sheetHandle: {
		alignSelf: "center",
		width: 40,
		height: 4,
		borderRadius: 2,
		backgroundColor: "rgba(128,128,128,0.4)",
		marginBottom: Spacing.three,
	},
	sheetLabel: {
		marginBottom: Spacing.two,
	},
	sheetList: {
		flexGrow: 0,
	},
	leagueItem: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingVertical: Spacing.two,
		paddingHorizontal: Spacing.two,
		borderRadius: 10,
	},
	leagueName: {
		flex: 1,
	},
	footerRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingVertical: Spacing.three,
		paddingHorizontal: Spacing.two,
		marginTop: Spacing.two,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: "rgba(128,128,128,0.3)",
	},
});
