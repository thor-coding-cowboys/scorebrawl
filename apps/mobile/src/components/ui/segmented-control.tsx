import { useState } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";

export function SegmentedControl<T extends string>({
	options,
	value,
	onChange,
}: {
	options: readonly { value: T; label: string }[];
	value: T;
	onChange: (value: T) => void;
}) {
	const theme = useTheme();
	const [width, setWidth] = useState(0);
	const index = Math.max(
		0,
		options.findIndex((option) => option.value === value)
	);
	const segmentWidth = options.length > 0 ? (width - 6) / options.length : 0;

	const indicatorStyle = useAnimatedStyle(() => ({
		width: segmentWidth,
		transform: [{ translateX: withTiming(index * segmentWidth, { duration: 180 }) }],
	}));

	return (
		<View
			accessibilityRole="tablist"
			onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
			style={[styles.container, { backgroundColor: theme.segmentTrack, borderColor: theme.border }]}
		>
			{width > 0 ? (
				<Animated.View
					style={[
						styles.indicator,
						{ backgroundColor: theme.segmentThumb, borderColor: theme.segmentThumbBorder },
						indicatorStyle,
					]}
				/>
			) : null}
			{options.map((option) => {
				const selected = option.value === value;
				return (
					<Pressable
						key={option.value}
						accessibilityRole="tab"
						accessibilityState={{ selected }}
						onPress={() => onChange(option.value)}
						style={styles.segment}
					>
						<ThemedText
							type="small"
							themeColor={selected ? "foreground" : "mutedForeground"}
							numberOfLines={1}
							style={styles.label}
						>
							{option.label}
						</ThemedText>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		padding: 3,
		borderWidth: StyleSheet.hairlineWidth,
	},
	indicator: {
		position: "absolute",
		top: 3,
		bottom: 3,
		left: 3,
		borderWidth: StyleSheet.hairlineWidth,
	},
	segment: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		paddingVertical: 5,
	},
	label: {
		fontSize: 12,
		lineHeight: 18,
	},
});
