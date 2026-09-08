import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SymbolView } from "expo-symbols";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
	Alert,
	FlatList,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";

type Invitation = {
	id: string;
	email: string;
	role: string | null;
	status: "pending" | "accepted" | "rejected" | "canceled";
	expiresAt: string | number | Date;
	createdAt: string | number | Date;
};

const ROLE_OPTIONS = ["member", "editor", "viewer"] as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STATUS_CONFIG: Record<
	Invitation["status"],
	{ color: string; icon: Parameters<typeof SymbolView>[0]["name"] }
> = {
	pending: {
		color: "#eab308",
		icon: { ios: "clock.fill", android: "schedule", web: "schedule" },
	},
	accepted: {
		color: "#16a34a",
		icon: { ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" },
	},
	rejected: {
		color: "#dc2626",
		icon: { ios: "xmark.circle.fill", android: "cancel", web: "cancel" },
	},
	canceled: {
		color: "#6b7280",
		icon: { ios: "minus.circle.fill", android: "remove_circle", web: "remove_circle" },
	},
};

function formatRole(role: string) {
	return role
		.replace(/_/g, " ")
		.split(" ")
		.map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
		.join(" ");
}

function formatDate(date: string | number | Date) {
	return new Date(date).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function StatusPill({ status }: { status: Invitation["status"] }) {
	const { color, icon } = STATUS_CONFIG[status];
	return (
		<View style={[styles.pill, { backgroundColor: `${color}1a`, borderColor: `${color}40` }]}>
			<SymbolView name={icon} size={12} tintColor={color} />
			<ThemedText type="small" style={{ color, fontSize: 11 }}>
				{formatRole(status)}
			</ThemedText>
		</View>
	);
}

function InviteMemberForm({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const queryClient = useQueryClient();
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<string>("member");
	const [submitted, setSubmitted] = useState(false);
	const [apiError, setApiError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (isOpen) {
			setEmail("");
			setRole("member");
			setSubmitted(false);
			setApiError("");
			setIsSubmitting(false);
		}
	}, [isOpen]);

	const emailError = !submitted
		? undefined
		: !EMAIL_REGEX.test(email)
			? "Enter a valid email address"
			: undefined;

	const canSubmit = !isSubmitting && EMAIL_REGEX.test(email);

	const onSubmit = async () => {
		if (isSubmitting) return;
		setSubmitted(true);
		setApiError("");
		setIsSubmitting(true);
		try {
			const { error } = await authClient.organization.inviteMember({
				email,
				role: role as "member" | "admin" | "owner",
			});
			if (error) {
				throw error;
			}
			await queryClient.invalidateQueries({ queryKey: ["invitation"] });
			onClose();
		} catch (err) {
			setApiError(err instanceof Error ? err.message : "Failed to send invitation.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal visible={isOpen} animationType="slide" onRequestClose={onClose}>
			<ThemedView style={styles.modalContainer}>
				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : undefined}
					style={styles.keyboardAvoid}
				>
					<View style={[styles.content, { paddingTop: insets.top + Spacing.three }]}>
						<View style={styles.modalHeader}>
							<ThemedText type="subtitle" style={styles.modalTitle}>
								Invite Member
							</ThemedText>
							<ModalCloseButton onPress={onClose} />
						</View>

						<ScrollView
							style={styles.scroll}
							contentContainerStyle={styles.form}
							keyboardShouldPersistTaps="handled"
						>
							<View style={styles.roleList}>
								{ROLE_OPTIONS.map((option) => {
									const selected = role === option;
									return (
										<Pressable
											key={option}
											accessibilityRole="radio"
											accessibilityState={{ selected }}
											onPress={() => {
												setRole(option);
												setApiError("");
											}}
											disabled={isSubmitting}
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
												{formatRole(option)}
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

							<Input
								label="Email"
								placeholder="member@example.com"
								value={email}
								onChangeText={(text) => {
									setEmail(text);
									setApiError("");
								}}
								autoCapitalize="none"
								autoCorrect={false}
								keyboardType="email-address"
								editable={!isSubmitting}
								error={emailError}
							/>
							{apiError ? (
								<ThemedText type="small" style={{ color: theme.destructive }}>
									{apiError}
								</ThemedText>
							) : null}
						</ScrollView>

						<View style={[styles.modalActions, { paddingBottom: insets.bottom + Spacing.two }]}>
							<Button
								fullWidth
								variant="glow"
								onPress={onSubmit}
								loading={isSubmitting}
								disabled={!canSubmit}
							>
								{isSubmitting ? "Sending..." : "Send Invitation"}
							</Button>
						</View>
					</View>
				</KeyboardAvoidingView>
			</ThemedView>
		</Modal>
	);
}

export default function InvitationsScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ create?: string }>();
	const theme = useTheme();
	const queryClient = useQueryClient();
	const { data: activeMember, isPending: isMemberPending } = authClient.useActiveMember();
	const role = activeMember?.role;
	const canAccess = role === "owner" || role === "editor";
	const [isInviteOpen, setIsInviteOpen] = useState(false);
	const [pendingAction, setPendingAction] = useState<{
		id: string;
		kind: "resend" | "cancel";
	} | null>(null);

	useEffect(() => {
		if (params.create !== "1") return;
		if (isMemberPending) return;
		if (canAccess) {
			setIsInviteOpen(true);
		}
		router.setParams({ create: undefined });
	}, [params.create, canAccess, isMemberPending, router]);

	const {
		data: invitations = [],
		isLoading,
		isError,
		refetch,
	} = useQuery({
		queryKey: ["invitation", "list"],
		queryFn: async () => {
			const { data, error } = await authClient.organization.listInvitations({});
			if (error) {
				throw error;
			}
			return (data ?? []) as Invitation[];
		},
		enabled: canAccess,
	});

	const resendMutation = useMutation({
		mutationFn: async (invitation: Invitation) => {
			const { error } = await authClient.organization.inviteMember({
				email: invitation.email,
				role: (invitation.role || "member") as "member" | "admin" | "owner",
				resend: true,
			});
			if (error) {
				throw error;
			}
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["invitation"] });
			setPendingAction(null);
		},
		onError: (error) => {
			setPendingAction(null);
			Alert.alert("Error", error instanceof Error ? error.message : "Failed to resend invitation.");
		},
	});

	const cancelMutation = useMutation({
		mutationFn: async (invitation: Invitation) => {
			const { error } = await authClient.organization.cancelInvitation({
				invitationId: invitation.id,
			});
			if (error) {
				throw error;
			}
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["invitation"] });
			setPendingAction(null);
		},
		onError: (error) => {
			setPendingAction(null);
			Alert.alert("Error", error instanceof Error ? error.message : "Failed to cancel invitation.");
		},
	});

	const confirmCancel = (invitation: Invitation) => {
		Alert.alert("Cancel invitation", `Remove the invitation to ${invitation.email}?`, [
			{ text: "Keep", style: "cancel" },
			{
				text: "Cancel Invite",
				style: "destructive",
				onPress: () => {
					setPendingAction({ id: invitation.id, kind: "cancel" });
					cancelMutation.mutate(invitation);
				},
			},
		]);
	};

	const handleResend = (invitation: Invitation) => {
		if (pendingAction) return;
		setPendingAction({ id: invitation.id, kind: "resend" });
		resendMutation.mutate(invitation);
	};

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView edges={["bottom"]} style={styles.safeArea}>
				<View style={styles.headerRow}>
					<ThemedText type="title" style={styles.title}>
						Invitations
					</ThemedText>
					{canAccess ? (
						<Button variant="outline" onPress={() => setIsInviteOpen(true)}>
							Invite
						</Button>
					) : null}
				</View>
				<FlatList
					data={invitations}
					keyExtractor={(item) => item.id}
					renderItem={({ item }) => {
						const expired = new Date(item.expiresAt) < new Date();
						const actionable = item.status === "pending" || expired;
						return (
							<View style={styles.rowBlock}>
								<View style={styles.row}>
									<View style={styles.rowInfo}>
										<ThemedText style={styles.rowName} numberOfLines={1}>
											{item.email}
										</ThemedText>
										<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
											{formatRole(item.role || "member")} • Sent {formatDate(item.createdAt)}
										</ThemedText>
									</View>
									<StatusPill status={item.status} />
								</View>
								{actionable ? (
									<View style={styles.actions}>
										<Button
											variant="outline"
											onPress={() => handleResend(item)}
											loading={pendingAction?.id === item.id && pendingAction.kind === "resend"}
											disabled={!!pendingAction}
										>
											Resend
										</Button>
										{item.status === "pending" ? (
											<Button
												variant="outline"
												onPress={() => confirmCancel(item)}
												loading={pendingAction?.id === item.id && pendingAction.kind === "cancel"}
												disabled={!!pendingAction}
												style={{ borderColor: theme.destructive }}
											>
												Cancel
											</Button>
										) : null}
									</View>
								) : null}
							</View>
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
								You don’t have access to manage invitations.
							</ThemedText>
						) : isLoading ? (
							<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
								Loading…
							</ThemedText>
						) : isError ? (
							<View style={styles.emptyBox}>
								<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
									Couldn’t load invitations
								</ThemedText>
								<Button variant="outline" onPress={() => refetch()}>
									Retry
								</Button>
							</View>
						) : (
							<ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
								No invitations sent yet
							</ThemedText>
						)
					}
				/>
			</SafeAreaView>
			<InviteMemberForm isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} />
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
	keyboardAvoid: {
		flex: 1,
	},
	safeArea: {
		flex: 1,
		maxWidth: MaxContentWidth,
		paddingHorizontal: Spacing.four,
		paddingBottom: BottomTabInset + Spacing.three,
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginTop: Spacing.four,
		marginBottom: Spacing.three,
	},
	title: {
		flex: 1,
	},
	list: {
		paddingBottom: Spacing.four,
	},
	rowBlock: {
		paddingVertical: Spacing.three,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "rgba(128,128,128,0.25)",
	},
	row: {
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
	pill: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.one,
		borderWidth: 1,
		borderRadius: 8,
		paddingVertical: 2,
		paddingHorizontal: Spacing.two,
	},
	actions: {
		flexDirection: "row",
		justifyContent: "flex-end",
		gap: Spacing.two,
		marginTop: Spacing.two,
	},
	empty: {
		textAlign: "center",
		marginTop: Spacing.five,
	},
	emptyBox: {
		alignItems: "center",
		gap: Spacing.three,
	},
	content: {
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
	scroll: {
		flex: 1,
	},
	form: {
		gap: Spacing.three,
		paddingBottom: Spacing.four,
	},
	roleList: {
		gap: Spacing.two,
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
		paddingTop: Spacing.three,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: "rgba(128,128,128,0.3)",
	},
});
