import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet } from "react-native";

import { useTheme } from "@/hooks/use-theme";

export function ModalCloseButton({ onPress }: { onPress: () => void }) {
	const theme = useTheme();

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel="Close"
			onPress={onPress}
			hitSlop={8}
			style={({ pressed }) => [styles.button, pressed && { opacity: 0.7 }]}
		>
			<SymbolView
				name={{ ios: "xmark", android: "close", web: "close" }}
				size={18}
				tintColor={theme.textSecondary}
			/>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	button: {
		width: 32,
		height: 32,
		alignItems: "center",
		justifyContent: "center",
	},
});
