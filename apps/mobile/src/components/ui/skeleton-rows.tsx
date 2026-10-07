import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

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
	style,
}: {
	avatarSize?: number | null;
	avatarRadius?: number;
	trailing?: ReactNode;
	style?: StyleProp<ViewStyle>;
}) {
	return (
		<View style={[styles.row, style]}>
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

export function SkeletonStandingRow() {
	return (
		<View style={styles.row}>
			<Skeleton width={40} height={40} radius={20} />
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

export function SkeletonStat({ labelWidth = 60 }: { labelWidth?: number }) {
	return (
		<View style={styles.stat}>
			<Skeleton width={labelWidth} height={9} />
			<Skeleton width={44} height={18} />
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
});
