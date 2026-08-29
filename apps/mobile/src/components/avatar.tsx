import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";

function getInitials(name: string) {
	const parts = name.split(/\s+/).filter(Boolean);
	const letters = parts.map((p) => p[0]?.toUpperCase()).filter(Boolean);
	return letters.slice(0, 2).join("") || "?";
}

export function Avatar({
	name,
	image,
	headers,
	size = 32,
}: {
	name: string;
	image?: string | null;
	headers?: Record<string, string>;
	size?: number;
}) {
	const theme = useTheme();
	const initials = getInitials(name);
	const [imageFailed, setImageFailed] = useState(false);

	useEffect(() => {
		setImageFailed(false);
	}, [image]);

	if (image && !imageFailed) {
		return (
			<Image
				source={{ uri: image, headers }}
				style={{ width: size, height: size, borderRadius: size / 2 }}
				contentFit="cover"
				onError={() => setImageFailed(true)}
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
			<ThemedText
				type="smallBold"
				themeColor="primaryForeground"
				style={{ fontSize: size * 0.4, lineHeight: size * 0.4 * 1.4 }}
			>
				{initials}
			</ThemedText>
		</View>
	);
}
