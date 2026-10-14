/**
 * Colours are authored once in @coding-cowboys/scorebrawl-core/theme (oklch).
 * This module only shapes them for React Native: flat camelCase keys, hex,
 * and an explicit `mode`. Do not add literal colour values here.
 */

import "@/global.css";

import { toMobileColors } from "@coding-cowboys/scorebrawl-core/theme";
import type { MobileColors } from "@coding-cowboys/scorebrawl-core/theme";
import { Platform } from "react-native";

export type { MobileColors };

export const Colors: { light: MobileColors; dark: MobileColors } = {
	light: toMobileColors("light"),
	dark: toMobileColors("dark"),
};

const shared = Colors.light;

/**
 * Mode-invariant utility colours — safe to reference at module scope (e.g.
 * `StyleSheet.create`). `packages/core` tests assert light and dark agree.
 * Mode-dependent families (`glow`, `role`, the semantic tokens) must be read
 * from `useTheme()` instead.
 */
export const SharedColors = {
	divider: shared.divider,
	dividerBorder: shared.dividerBorder,
	dividerStrong: shared.dividerStrong,
	overlay: shared.overlay,
	overlaySoft: shared.overlaySoft,
	faint: shared.faint,
	warning: shared.warning,
	link: shared.link,
	brandFrom: shared.brandFrom,
	brandTo: shared.brandTo,
	formWin: shared.formWin,
	formDraw: shared.formDraw,
	formLoss: shared.formLoss,
	seasonStatusActiveText: shared.seasonStatusActiveText,
	seasonStatusUpcomingText: shared.seasonStatusUpcomingText,
	seasonStatusEndedText: shared.seasonStatusEndedText,
	seasonStatusLockedText: shared.seasonStatusLockedText,
	seasonStatusArchivedText: shared.seasonStatusArchivedText,
	invitationStatusPendingText: shared.invitationStatusPendingText,
	invitationStatusAcceptedText: shared.invitationStatusAcceptedText,
	invitationStatusRejectedText: shared.invitationStatusRejectedText,
	invitationStatusCanceledText: shared.invitationStatusCanceledText,
	scoreTypeEloText: shared.scoreTypeEloText,
	scoreTypeThreeOneZeroText: shared.scoreTypeThreeOneZeroText,
	scoreTypeOneVnEloText: shared.scoreTypeOneVnEloText,
};

/** Semantic surface/ink tokens addressable by `ThemedText`/`ThemedView`. */
export type ThemeColor =
	| "background"
	| "foreground"
	| "card"
	| "muted"
	| "mutedForeground"
	| "backgroundSelected"
	| "primary"
	| "primaryForeground"
	| "secondary"
	| "secondaryForeground"
	| "accent"
	| "accentForeground"
	| "border"
	| "input"
	| "ring"
	| "destructive";

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

export const MaxContentWidth = 800;
