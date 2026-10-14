import { avatarTones, selectAvatarIndex } from "@coding-cowboys/scorebrawl-core/theme";
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

function initialsFontSize(size: number) {
	if (size <= 24) return 12;
	if (size <= 40) return 14;
	return 18;
}

export function Avatar({
	name,
	image,
	headers,
	size = 32,
	borderRadius = 8,
}: {
	name: string;
	image?: string | null;
	headers?: Record<string, string>;
	size?: number;
	borderRadius?: number;
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
				style={{
					width: size,
					height: size,
					borderRadius,
					borderWidth: 1,
					borderColor: theme.border,
				}}
				contentFit="cover"
				onError={() => setImageFailed(true)}
			/>
		);
	}

	const index = selectAvatarIndex(name);
	const tone = index < 0 ? undefined : avatarTones("light")[index];
	const background = tone?.background ?? theme.divider;
	const text = tone?.text ?? theme.mutedForeground;
	const border = tone?.border ?? theme.border;
	const fontSize = initialsFontSize(size);

	return (
		<View
			style={{
				width: size,
				height: size,
				borderRadius,
				backgroundColor: background,
				borderWidth: 1,
				borderColor: border,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<ThemedText style={{ color: text, fontSize, lineHeight: fontSize * 1.2, fontWeight: "400" }}>
				{initials}
			</ThemedText>
		</View>
	);
}
