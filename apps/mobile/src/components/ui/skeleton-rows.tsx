import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Skeleton } from "@/components/ui/skeleton";
import { Spacing } from "@/constants/theme";

export function SkeletonHeader() {
	return (
		<View style={styles.header}>
			<Skeleton width={18} height={18} radius={4} />
			<Skeleton width={96} height={12} />
		</View>
	);
}

export function SkeletonSectionHeader({ width = 72 }: { width?: number }) {
	return <Skeleton width={width} height={9} style={styles.section} />;
}

export function SkeletonListRow({
	avatarSize = 40,
	avatarRadius,
	trailing,
}: {
	avatarSize?: number | null;
	avatarRadius?: number;
	trailing?: ReactNode;
}) {
	return (
		<View style={styles.row}>
			{avatarSize ? (
				<Skeleton width={avatarSize} height={avatarSize} radius={avatarRadius ?? avatarSize / 2} />
			) : null}
			<View style={styles.col}>
				<Skeleton width="55%" height={12} />
				<Skeleton width="72%" height={10} />
			</View>
			{trailing}
		</View>
	);
}

export function SkeletonStandingRow({ avatarSize = 40 }: { avatarSize?: number }) {
	return (
		<View style={styles.row}>
			<Skeleton width={avatarSize} height={avatarSize} radius={avatarSize / 2} />
			<View style={styles.col}>
				<Skeleton width="48%" height={12} />
				<Skeleton width="68%" height={10} />
			</View>
			<Skeleton width={28} height={18} />
		</View>
	);
}

export function SkeletonMatchRow() {
	return (
		<View style={styles.row}>
			<Skeleton width={52} height={26} radius={6} />
			<View style={styles.col}>
				<View style={styles.matchLine}>
					<Skeleton width="55%" height={11} />
					<Skeleton width={28} height={22} radius={6} />
				</View>
				<View style={styles.matchLine}>
					<Skeleton width="45%" height={11} />
					<Skeleton width={28} height={22} radius={6} />
				</View>
			</View>
		</View>
	);
}

export function SkeletonStat() {
	return (
		<View style={styles.stat}>
			<Skeleton width={60} height={9} />
			<Skeleton width={44} height={18} />
		</View>
	);
}

export function SkeletonStatGrid({ count = 2 }: { count?: number }) {
	return (
		<View style={styles.statGrid}>
			{Array.from({ length: count }).map((_, i) => (
				<SkeletonStat key={i} />
			))}
		</View>
	);
}

export function SkeletonTrailing() {
	return (
		<View style={styles.trailing}>
			<Skeleton width={46} height={16} radius={8} />
			<Skeleton width={54} height={24} radius={7} />
		</View>
	);
}

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		paddingVertical: Spacing.three,
	},
	section: {
		marginTop: Spacing.four,
		marginBottom: Spacing.two,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.three,
		paddingVertical: Spacing.three,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "rgba(128,128,128,0.25)",
	},
	col: {
		flex: 1,
		gap: 7,
	},
	matchLine: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: Spacing.two,
	},
	stat: {
		flex: 1,
		gap: 6,
		paddingVertical: Spacing.two,
	},
	statGrid: {
		flexDirection: "row",
		gap: Spacing.three,
	},
	trailing: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.two,
	},
});
