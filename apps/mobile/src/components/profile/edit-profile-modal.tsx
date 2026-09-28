import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { Spacing } from "@/constants/theme";
import { useUserAvatar } from "@/hooks/use-user-avatar";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import { trpcClient } from "@/lib/trpc";

export function EditProfileModal({
	isOpen,
	onClose,
	user,
}: {
	isOpen: boolean;
	onClose: () => void;
	user: { name?: string | null; email?: string | null; image?: string | null };
}) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const queryClient = useQueryClient();
	const { uri, headers } = useUserAvatar(user.image);

	const [name, setName] = useState(user.name ?? "");
	const [isSaving, setIsSaving] = useState(false);
	const [isAvatarBusy, setIsAvatarBusy] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (isOpen) {
			setName(user.name ?? "");
			setError("");
		}
	}, [isOpen, user.name]);

	const refresh = async () => {
		await authClient.getSession();
		await queryClient.invalidateQueries();
	};

	const pickAvatar = async () => {
		setError("");
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			allowsEditing: true,
			aspect: [1, 1],
			quality: 0.8,
			base64: true,
		});
		const asset = result.assets?.[0];
		if (result.canceled || !asset?.base64) return;
		setIsAvatarBusy(true);
		try {
			await trpcClient.user.uploadAvatar.mutate({
				imageData: `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`,
			});
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to upload avatar");
		} finally {
			setIsAvatarBusy(false);
		}
	};

	const removeAvatar = async () => {
		setError("");
		setIsAvatarBusy(true);
		try {
			await trpcClient.user.deleteAvatar.mutate();
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to remove avatar");
		} finally {
			setIsAvatarBusy(false);
		}
	};

	const save = async () => {
		if (!name.trim() || isSaving) return;
		setIsSaving(true);
		setError("");
		try {
			await authClient.updateUser({ name: name.trim() });
			await refresh();
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save profile");
		} finally {
			setIsSaving(false);
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
						<ThemedText type="subtitle">Edit Profile</ThemedText>
						<ModalCloseButton onPress={onClose} />
					</View>

					<View style={styles.avatarBlock}>
						<Pressable onPress={pickAvatar} disabled={isAvatarBusy}>
							<Avatar
								name={name || "?"}
								image={uri}
								headers={headers}
								size={96}
								borderRadius={24}
							/>
						</Pressable>
						<Pressable onPress={pickAvatar} disabled={isAvatarBusy}>
							<ThemedText type="small" themeColor="primary">
								{isAvatarBusy ? "Uploading…" : "Change avatar"}
							</ThemedText>
						</Pressable>
						{user.image ? (
							<Pressable onPress={removeAvatar} disabled={isAvatarBusy}>
								<ThemedText type="small" style={{ color: theme.destructive }}>
									Remove avatar
								</ThemedText>
							</Pressable>
						) : null}
					</View>

					<Input
						label="Name"
						placeholder="Your name"
						value={name}
						onChangeText={setName}
						editable={!isSaving}
					/>
					<Input label="Email" value={user.email ?? ""} editable={false} placeholder="Email" />

					{error ? (
						<ThemedText type="small" style={{ color: theme.destructive }}>
							{error}
						</ThemedText>
					) : null}

					<View style={styles.actions}>
						<Button variant="outline" onPress={onClose} disabled={isSaving}>
							Cancel
						</Button>
						<Button
							variant="glow"
							style={styles.submit}
							onPress={save}
							loading={isSaving}
							disabled={!name.trim()}
						>
							Save Changes
						</Button>
					</View>
				</View>
			</ThemedView>
		</Modal>
	);
}

const styles = StyleSheet.create({
	flex: { flex: 1 },
	content: { flex: 1, paddingHorizontal: Spacing.four, gap: Spacing.three },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	avatarBlock: { alignItems: "center", gap: Spacing.one },
	actions: { flexDirection: "row", gap: Spacing.two, marginTop: Spacing.two },
	submit: { flex: 1 },
});
