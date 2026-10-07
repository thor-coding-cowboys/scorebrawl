import { useEffect } from "react";
import { type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/use-theme";

export function Skeleton({
	width,
	height,
	radius = 4,
	style,
}: {
	width?: DimensionValue;
	height?: DimensionValue;
	radius?: number;
	style?: StyleProp<ViewStyle>;
}) {
	const theme = useTheme();
	const opacity = useSharedValue(1);

	useEffect(() => {
		opacity.value = withRepeat(
			withTiming(0.45, { duration: 900, easing: Easing.inOut(Easing.ease) }),
			-1,
			true
		);
	}, [opacity]);

	const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

	return (
		<Animated.View
			style={[
				{ width, height, borderRadius: radius, backgroundColor: theme.backgroundElement },
				animatedStyle,
				style,
			]}
		/>
	);
}
