/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import "@/global.css";

import { Platform } from "react-native";

export const Colors = {
	light: {
		text: "#000000",
		background: "#ffffff",
		backgroundElement: "#F0F0F3",
		backgroundSelected: "#E0E1E6",
		textSecondary: "#60646C",
		primary: "#7c3aed",
		buttonPrimary: "#3704fd",
		primaryForeground: "#ffffff",
		glowBlueBg: "rgba(59, 130, 246, 0.10)",
		glowBlueText: "#2563eb",
		glowBlueBorder: "rgba(59, 130, 246, 0.20)",
		border: "#E4E4E7",
		destructive: "#dc2626",
		card: "#ffffff",
		mutedForeground: "#71717a",
		splashBackground: "#FAFBFE",
	},
	dark: {
		text: "#ffffff",
		background: "#000000",
		backgroundElement: "#212225",
		backgroundSelected: "#2E3135",
		textSecondary: "#B0B4BA",
		primary: "#8b5cf6",
		buttonPrimary: "#4515ff",
		primaryForeground: "#ffffff",
		glowBlueBg: "rgba(37, 99, 235, 0.20)",
		glowBlueText: "#93c5fd",
		glowBlueBorder: "rgba(37, 99, 235, 0.30)",
		border: "rgba(255, 255, 255, 0.1)",
		destructive: "#f87171",
		card: "#202023",
		mutedForeground: "#a1a1aa",
		splashBackground: "#061739",
	},
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

const MONO_STACK =
	"ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

export const Fonts = {
	sans:
		Platform.select({
			ios: "Menlo",
			android: "monospace",
			web: MONO_STACK,
			default: "monospace",
		}) ?? "monospace",
	mono:
		Platform.select({
			ios: "Menlo",
			android: "monospace",
			web: MONO_STACK,
			default: "monospace",
		}) ?? "monospace",
};

export const Spacing = {
	half: 2,
	one: 4,
	two: 8,
	three: 16,
	four: 24,
	five: 32,
	six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
