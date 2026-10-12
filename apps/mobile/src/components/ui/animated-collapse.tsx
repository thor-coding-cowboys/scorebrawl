import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useDerivedValue,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

export function useCollapseProgress(expanded: boolean): SharedValue<number> {
	return useDerivedValue<number>(() =>
		withTiming(expanded ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) })
	);
}

export function AnimatedCollapse({
	expanded,
	progress,
	style,
	children,
}: {
	expanded: boolean;
	progress: Readonly<SharedValue<number>>;
	style?: StyleProp<ViewStyle>;
	children: ReactNode;
}) {
	const contentHeight = useSharedValue(0);
	const clipStyle = useAnimatedStyle(() => ({
		height: contentHeight.value * progress.value,
		opacity: progress.value,
	}));

	return (
		<Animated.View
			style={[styles.clip, clipStyle]}
			pointerEvents={expanded ? "auto" : "none"}
			accessibilityElementsHidden={!expanded}
			importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
		>
			<View
				style={styles.content}
				onLayout={(e) => {
					contentHeight.value = e.nativeEvent.layout.height;
				}}
			>
				<View style={style}>{children}</View>
			</View>
		</Animated.View>
	);
}

export function useRotation(progress: Readonly<SharedValue<number>>, degrees: number) {
	return useAnimatedStyle(() => ({
		transform: [{ rotate: `${degrees * progress.value}deg` }],
	}));
}

const styles = StyleSheet.create({
	clip: {
		overflow: "hidden",
	},
	content: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
	},
});
