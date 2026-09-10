import { StyleSheet, View } from "react-native";

import { StreakAvatar } from "@/components/streak-avatar";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";

export type StandingItem = {
	id: string;
	name: string;
	image?: string | null;
	score: number;
	matchCount: number;
	winCount: number;
	pointDiff: number;
	form?: ("W" | "D" | "L")[];
};

function winPct(item: StandingItem) {
	return item.matchCount > 0 ? Math.round((item.winCount / item.matchCount) * 100) : 0;
}

function calculateStreak(form?: ("W" | "D" | "L")[]) {
	if (!form || form.length === 0) return 0;
	let streak = 0;
	const first = form[0];
	for (const result of form) {
		if (result === first) {
			streak += first === "W" ? 1 : first === "L" ? -1 : 0;
		} else {
			break;
		}
	}
	return streak;
}

const FORM_COLORS = {
	W: "#16a34a",
	D: "#d97706",
	L: "#dc2626",
} as const;

const RANK_COLORS = ["#f59e0b", "#94a3b8", "#d97706"] as const;

function FormDots({
	form,
	pointDiff,
}: {
	form: ("W" | "D" | "L")[] | undefined;
	pointDiff: number;
}) {
	const diffColor = pointDiff > 0 ? "#16a34a" : pointDiff < 0 ? "#dc2626" : undefined;

	if (!form || form.length === 0) {
		return (
			<>
				<ThemedText type="small" themeColor="textSecondary">
					–
				</ThemedText>
				{pointDiff !== 0 ? (
					<ThemedText type="small" style={{ color: diffColor }}>
						{pointDiff > 0 ? `+${pointDiff}` : pointDiff}
					</ThemedText>
				) : null}
			</>
		);
	}

	return (
		<>
			<View style={styles.formDots}>
				{(() => {
					const counts: Record<string, number> = {};
					return [...form].reverse().map((result) => {
						counts[result] = (counts[result] ?? 0) + 1;
						return (
							<View
								key={`${result}-${counts[result]}`}
								style={[styles.formDot, { backgroundColor: FORM_COLORS[result] }]}
							/>
						);
					});
				})()}
			</View>
			{pointDiff !== 0 ? (
				<ThemedText type="small" style={{ color: diffColor }}>
					{pointDiff > 0 ? `+${pointDiff}` : pointDiff}
				</ThemedText>
			) : null}
		</>
	);
}

export function StandingRow({
	item,
	rank,
	headers,
}: {
	item: StandingItem;
	rank: number;
	headers?: Record<string, string>;
}) {
	const streak = calculateStreak(item.form);
	const rankColor = RANK_COLORS[rank - 1];

	return (
		<View style={styles.row}>
			<ThemedText
				type="small"
				style={[styles.rank, rankColor ? { color: rankColor, fontWeight: "700" } : undefined]}
			>
				{rank}
			</ThemedText>
			<StreakAvatar name={item.name} image={item.image} headers={headers} streak={streak} />
			<View style={styles.info}>
				<ThemedText numberOfLines={1} style={styles.name}>
					{item.name}
				</ThemedText>
				<View style={styles.meta}>
					<ThemedText type="small" themeColor="textSecondary">
						{item.matchCount} MP
					</ThemedText>
					<View style={styles.dot} />
					<ThemedText type="small" themeColor="textSecondary">
						{winPct(item)}% W
					</ThemedText>
					<View style={styles.metaDivider} />
					<FormDots form={item.form} pointDiff={item.pointDiff} />
				</View>
			</View>
			<ThemedText style={[styles.score, item.matchCount === 0 && styles.scoreZero]}>
				{item.score}
			</ThemedText>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
		paddingVertical: Spacing.three,
	},
	rank: {
		width: 24,
		textAlign: "center",
		color: "#60646C",
	},
	info: {
		flex: 1,
		gap: 3,
	},
	name: {
		fontWeight: "600",
	},
	meta: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.one,
	},
	dot: {
		width: 3,
		height: 3,
		borderRadius: 2,
		backgroundColor: "rgba(128,128,128,0.5)",
	},
	metaDivider: {
		width: StyleSheet.hairlineWidth,
		height: 12,
		backgroundColor: "rgba(128,128,128,0.3)",
		marginHorizontal: Spacing.one,
	},
	formDots: {
		flexDirection: "row",
		alignItems: "center",
		gap: 3,
	},
	formDot: {
		width: 6,
		height: 6,
		borderRadius: 3,
	},
	score: {
		fontWeight: "700",
		fontSize: 18,
		lineHeight: 24,
		minWidth: 34,
		textAlign: "right",
	},
	scoreZero: {
		color: "#9CA3AF",
		fontWeight: "400",
		fontSize: 15,
	},
});
