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

const NAME_COLORS: { bg: string; text: string; border: string }[] = [
	{ bg: "#10b9811a", text: "#059669", border: "#10b98133" },
	{ bg: "#3b82f61a", text: "#2563eb", border: "#3b82f633" },
	{ bg: "#f59e0b1a", text: "#d97706", border: "#f59e0b33" },
	{ bg: "#a855f71a", text: "#9333ea", border: "#a855f733" },
	{ bg: "#f43f5e1a", text: "#e11d48", border: "#f43f5e33" },
	{ bg: "#06b6d41a", text: "#0891b2", border: "#06b6d433" },
	{ bg: "#f973161a", text: "#ea580c", border: "#f9731633" },
	{ bg: "#6366f11a", text: "#4f46e5", border: "#6366f133" },
	{ bg: "#ec48991a", text: "#db2777", border: "#ec489933" },
	{ bg: "#14b8a61a", text: "#0d9488", border: "#14b8a633" },
	{ bg: "#84cc161a", text: "#65a30d", border: "#84cc1633" },
	{ bg: "#8b5cf61a", text: "#7c3aed", border: "#8b5cf633" },
];

const GRAY = { bg: "#6b72801a", text: "#4b5563", border: "#6b728033" };

function getNameColor(name: string) {
	if (!name) return GRAY;
	const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");
	let hash = 0;
	for (let i = 0; i < normalized.length; i++) {
		hash = (hash << 5) - hash + normalized.charCodeAt(i);
		hash = hash & hash;
	}
	const index = Math.abs(hash) % NAME_COLORS.length;
	return NAME_COLORS[index] ?? GRAY;
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

	const color = getNameColor(name);
	const fontSize = initialsFontSize(size);

	return (
		<View
			style={{
				width: size,
				height: size,
				borderRadius,
				backgroundColor: color.bg,
				borderWidth: 1,
				borderColor: color.border,
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<ThemedText
				style={{ color: color.text, fontSize, lineHeight: fontSize * 1.2, fontWeight: "500" }}
			>
				{initials}
			</ThemedText>
		</View>
	);
}
