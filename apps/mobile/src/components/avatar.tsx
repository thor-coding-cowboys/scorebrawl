import { Image } from "expo-image";
import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";

function getInitials(name: string) {
	const parts = name.split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
	name,
	image,
	size = 32,
}: {
	name: string;
	image?: string | null;
	size?: number;
}) {
	const theme = useTheme();
	const initials = getInitials(name);

	if (image) {
		return (
			<Image
				source={{ uri: image }}
				style={{ width: size, height: size, borderRadius: size / 2 }}
				contentFit="cover"
			/>
		);
	}

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
			<ThemedText type="smallBold" themeColor="primaryForeground" style={{ fontSize: size * 0.4 }}>
				{initials}
			</ThemedText>
		</View>
	);
}
