import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { getAvatarUri } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { authClient, getAuthCookie } from "@/lib/auth-client";

type Member = {
	id: string;
	role: string;
	createdAt?: string | number | Date;
	user?: {
		name?: string | null;
		email?: string | null;
		image?: string | null;
	};
	name?: string | null;
	email?: string | null;
	image?: string | null;
};

type MembersData = { members: Member[]; total: number } | Member[];

const ROLE_OPTIONS = ["owner", "editor", "member", "viewer"] as const;

function formatRole(role: string) {
	return role
		.replace(/_/g, " ")
		.split(" ")
		.map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
		.join(" ");
}

function ChangeRoleModal({
	member,
	isOpen,
	onClose,
}: {
	member: Member | null;
	isOpen: boolean;
	onClose: () => void;
}) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const queryClient = useQueryClient();
	const [selectedRole, setSelectedRole] = useState<string>(member?.role ?? "member");
	const [apiError, setApiError] = useState("");

	useEffect(() => {
		if (isOpen && member) {
			setSelectedRole(member.role || "member");
			setApiError("");
		}
	}, [isOpen, member]);

	const updateRoleMutation = useMutation({
		mutationFn: async ({ memberId, role }: { memberId: string; role: string }) => {
			const { error } = await authClient.organization.updateMemberRole({ memberId, role });
			if (error) {
				throw error;
			}
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["member"] });
			onClose();
		},
		onError: (error) => {
			setApiError(error instanceof Error ? error.message : "Failed to update role.");
		},
	});

	const name = member?.user?.name || member?.name || "Member";
	const email = member?.user?.email || member?.email || "";
	const currentRole = member?.role || "member";
	const isSameRole = selectedRole === currentRole;

	const onSave = () => {
		if (!member || isSameRole || updateRoleMutation.isPending) return;
		setApiError("");
		updateRoleMutation.mutate({ memberId: member.id, role: selectedRole });
	};

	return (
		<Modal visible={isOpen} animationType="slide" onRequestClose={onClose}>
			<ThemedView style={styles.modalContainer}>
				<View style={[styles.modalContent, { paddingTop: insets.top + Spacing.three }]}>
					<View style={styles.modalHeader}>
						<ThemedText type="subtitle" style={styles.modalTitle}>
							Change Role
						</ThemedText>
						<ModalCloseButton onPress={onClose} />
					</View>

					<View style={styles.modalIntro}>
						<ThemedText style={styles.memberName} numberOfLines={1}>
							{name}
						</ThemedText>
						{email ? (
							<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
								{email}
							</ThemedText>
						) : null}
					</View>

					<View style={styles.roleList}>
						{ROLE_OPTIONS.map((role) => {
							const selected = selectedRole === role;
							return (
								<Pressable
									key={role}
									accessibilityRole="radio"
									accessibilityState={{ selected }}
									onPress={() => {
										setSelectedRole(role);
										setApiError("");
									}}
									disabled={updateRoleMutation.isPending}
									style={({ pressed }) => [
										styles.roleRow,
										{
											borderColor: selected ? theme.primary : theme.border,
											backgroundColor: selected ? `${theme.primary}14` : theme.background,
										},
										pressed && { opacity: 0.7 },
									]}
								>
									<ThemedText
										type="smallBold"
										style={{ color: selected ? theme.primary : theme.text }}
									>
										{formatRole(role)}
									</ThemedText>
									{selected ? (
										<SymbolView
											name={{
												ios: "checkmark.circle.fill",
												android: "check_circle",
												web: "check_circle",
											}}
											size={20}
											tintColor={theme.primary}
										/>
									) : null}
								</Pressable>
							);
						})}
					</View>

					{apiError ? (
						<ThemedText type="small" style={{ color: theme.destructive }}>
							{apiError}
						</ThemedText>
					) : null}

					<View style={[styles.modalActions, { paddingBottom: insets.bottom + Spacing.two }]}>
						<Button
							fullWidth
							variant="glow"
							onPress={onSave}
							loading={updateRoleMutation.isPending}
							disabled={isSameRole}
						>
							{updateRoleMutation.isPending ? "Saving..." : "Save Role"}
						</Button>
					</View>
				</View>
			</ThemedView>
		</Modal>
	);
}

export default function MembersScreen() {
	const theme = useTheme();
	const { data: activeMember, isPending: isMemberPending } = authClient.useActiveMember();
	const role = activeMember?.role;
	const canAccess = role === "owner" || role === "editor";
	const [cookie, setCookie] = useState<string | undefined>();
	const [selectedMember, setSelectedMember] = useState<Member | null>(null);

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

	const {
		data: membersData,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		queryKey: ["member", "list"],
		queryFn: async () => {
			const { data, error } = await authClient.organization.listMembers();
			if (error) {
				throw error;
			}
			return data as MembersData;
		},
		enabled: canAccess,
	});

	const members = Array.isArray(membersData) ? membersData : (membersData?.members ?? []);

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={["bottom"]} style={styles.safeArea}>
				<ThemedText type="title" style={styles.title}>
					Members
				</ThemedText>
				<FlatList
					data={members}
					keyExtractor={(item) => item.id}
					renderItem={({ item }) => {
						const name = item.user?.name || item.name || "Unknown";
						const email = item.user?.email || item.email || "";
						const currentRole = item.role || "member";
						const canEditThisRole = currentRole !== "owner";
						return (
							<Card style={styles.card}>
								<View style={styles.cardRow}>
									<Avatar
										name={name}
										image={getAvatarUri(item.user?.image ?? item.image)}
										headers={avatarHeaders}
										size={40}
									/>
									<View style={styles.rowInfo}>
										<ThemedText style={styles.rowName} numberOfLines={1}>
											{name}
										</ThemedText>
										<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
											{email || "No email"}
										</ThemedText>
									</View>
									{canEditThisRole ? (
										<Button variant="outline" onPress={() => setSelectedMember(item)}>
											Change Role
										</Button>
									) : (
										<View
											style={[
												styles.rolePill,
												{
													backgroundColor: `${theme.primary}1a`,
													borderColor: `${theme.primary}40`,
												},
											]}
										>
											<ThemedText type="small" style={{ color: theme.primary, fontSize: 11 }}>
												{formatRole(currentRole)}
											</ThemedText>
										</View>
									)}
								</View>
							</Card>
						);
					}}
					contentContainerStyle={styles.list}
					ListEmptyComponent={
						isMemberPending ? (
							<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
								Loading…
							</ThemedText>
						) : !canAccess ? (
							<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
								You don’t have access to manage members.
							</ThemedText>
						) : isLoading ? (
							<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
								Loading…
							</ThemedText>
						) : isError ? (
							<View style={styles.emptyBox}>
								<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
									Couldn’t load members
								</ThemedText>
								<Button variant="outline" onPress={() => refetch()}>
									Retry
								</Button>
							</View>
						) : (
							<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
								No members yet
							</ThemedText>
						)
					}
				/>
			</SafeAreaView>
			<ChangeRoleModal
				member={selectedMember}
				isOpen={selectedMember !== null}
				onClose={() => setSelectedMember(null)}
			/>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		flexDirection: "row",
		justifyContent: "center",
	},
	modalContainer: {
		flex: 1,
	},
	modalContent: {
		flex: 1,
		paddingHorizontal: Spacing.four,
	},
	modalHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	modalTitle: {
		fontSize: 24,
		lineHeight: 32,
		fontWeight: "700",
		marginBottom: Spacing.four,
	},
	modalIntro: {
		marginBottom: Spacing.four,
		gap: Spacing.one,
	},
	memberName: {
		fontWeight: "600",
	},
	roleList: {
		gap: Spacing.two,
		marginBottom: Spacing.three,
	},
	roleRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		borderWidth: 2,
		borderRadius: 0,
		paddingHorizontal: Spacing.three,
		paddingVertical: Spacing.three,
	},
	modalActions: {
		marginTop: "auto",
		paddingTop: Spacing.three,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: "rgba(128,128,128,0.3)",
	},
	safeArea: {
		flex: 1,
		maxWidth: MaxContentWidth,
		paddingHorizontal: Spacing.four,
		paddingBottom: BottomTabInset + Spacing.three,
	},
	title: {
		marginTop: Spacing.four,
		marginBottom: Spacing.three,
	},
	list: {
		gap: Spacing.two,
		paddingBottom: Spacing.six,
	},
	card: {
		padding: Spacing.three,
	},
	cardRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
	},
	rowInfo: {
		flex: 1,
	},
	rowName: {
		fontWeight: "600",
		flexShrink: 1,
	},
	rolePill: {
		borderWidth: 1,
		borderRadius: 8,
		paddingVertical: 2,
		paddingHorizontal: Spacing.two,
	},
	empty: {
		textAlign: "center",
		marginTop: Spacing.five,
	},
	emptyBox: {
		alignItems: "center",
		gap: Spacing.three,
	},
});
