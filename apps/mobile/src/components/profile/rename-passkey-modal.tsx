import { useEffect, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export function RenamePasskeyModal({
	isOpen,
	currentName,
	isSaving,
	error,
	onClose,
	onSave,
}: {
	isOpen: boolean;
	currentName: string;
	isSaving: boolean;
	error?: string;
	onClose: () => void;
	onSave: (name: string) => void;
}) {
	const insets = useSafeAreaInsets();
	const theme = useTheme();
	const [name, setName] = useState(currentName);

	useEffect(() => {
		if (isOpen) setName(currentName);
	}, [isOpen, currentName]);

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
						<ThemedText type="subtitle">Rename Passkey</ThemedText>
						<ModalCloseButton onPress={onClose} />
					</View>

					<Input
						label="Passkey name"
						placeholder="My Passkey"
						value={name}
						onChangeText={setName}
						editable={!isSaving}
						autoFocus
					/>

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
							onPress={() => onSave(name.trim())}
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
	actions: { flexDirection: "row", gap: Spacing.two, marginTop: Spacing.two },
	submit: { flex: 1 },
});
