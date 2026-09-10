import { StyleSheet, View } from "react-native";

import { Avatar } from "@/components/avatar";

type StreakType = "fire" | "ice" | "none";

function getStreakType(streak: number): StreakType {
	if (streak >= 5) return "fire";
	if (streak <= -5) return "ice";
	return "none";
}

interface StreakAvatarProps {
	name: string;
	image?: string | null;
	headers?: Record<string, string>;
	streak: number;
}

const STREAK_STYLES: Record<Exclude<StreakType, "none">, { borderColor: string; bg: string }> = {
	fire: { borderColor: "#f97316", bg: "rgba(249,115,22,0.15)" },
	ice: { borderColor: "#38bdf8", bg: "rgba(56,189,248,0.15)" },
};

export function StreakAvatar({ name, image, headers, streak }: StreakAvatarProps) {
	const type = getStreakType(streak);

	if (type === "none") {
		return (
			<View style={styles.wrap}>
				<Avatar name={name} image={image} headers={headers} size={36} />
			</View>
		);
	}

	const colors = STREAK_STYLES[type];

	return (
		<View style={[styles.wrap, styles.ring, { borderColor: colors.borderColor }]}>
			<View style={[styles.innerBg, { backgroundColor: colors.bg }]}>
				<Avatar name={name} image={image} headers={headers} size={34} />
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		width: 40,
		height: 40,
		alignItems: "center",
		justifyContent: "center",
	},
	ring: {
		borderWidth: 2,
		borderRadius: 10,
	},
	innerBg: {
		borderRadius: 8,
	},
});
