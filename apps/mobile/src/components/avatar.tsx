import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
	const theme = useTheme();
	const initials = name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0]?.toUpperCase())
		.join("");
	return (
		<View
			style={{
				width: size,
				height: size,
				borderRadius: size / 2,
				backgroundColor: theme.primary,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<ThemedText type="smallBold" themeColor="primaryForeground">
				{initials || "?"}
			</ThemedText>
		</View>
	);
}
