import { glowIntensity } from "@coding-cowboys/scorebrawl-core/theme";
import { useId } from "react";
import { StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

export function CardGlow({
	color,
	intensity = glowIntensity,
}: {
	color: string;
	intensity?: number;
}) {
	const id = useId();
	return (
		<Svg style={StyleSheet.absoluteFill} pointerEvents="none">
			<Defs>
				<RadialGradient id={id} cx="100%" cy="0%" rx="80%" ry="110%" fx="100%" fy="0%">
					<Stop offset="0" stopColor={color} stopOpacity={intensity} />
					<Stop offset="0.45" stopColor={color} stopOpacity={intensity * 0.35} />
					<Stop offset="1" stopColor={color} stopOpacity={0} />
				</RadialGradient>
			</Defs>
			<Rect width="100%" height="100%" fill={`url(#${id})`} />
		</Svg>
	);
}
