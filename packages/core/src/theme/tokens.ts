import { withAlpha } from "./oklch";
import { palette } from "./palette";

export type ThemeMode = "light" | "dark";

/** Single knob for the radial card glow (web dashboard cards + mobile CardGlow). */
export const glowIntensity = 0.1;

type Tone = { text: string; solid: string };
type GlowToneTokens = Tone & { background: string; border: string; radial: string };
type AvatarTone = { background: string; text: string; border: string };

const semanticLight = {
	background: "oklch(1 0 0)",
	foreground: "oklch(0.141 0.005 285.823)",
	card: "oklch(1 0 0)",
	cardForeground: "oklch(0.141 0.005 285.823)",
	popover: "oklch(1 0 0)",
	popoverForeground: "oklch(0.141 0.005 285.823)",
	primary: "oklch(0.541 0.281 293.009)",
	primaryForeground: "oklch(0.969 0.016 293.756)",
	secondary: "oklch(0.967 0.001 286.375)",
	secondaryForeground: "oklch(0.21 0.006 285.885)",
	muted: "oklch(0.967 0.001 286.375)",
	mutedForeground: "oklch(0.552 0.016 285.938)",
	accent: "oklch(0.967 0.001 286.375)",
	accentForeground: "oklch(0.21 0.006 285.885)",
	destructive: "oklch(0.577 0.245 27.325)",
	border: "oklch(0.92 0.004 286.32)",
	input: "oklch(0.92 0.004 286.32)",
	ring: "oklch(0.705 0.015 286.067)",
	chart1: "oklch(0.811 0.111 293.571)",
	chart2: "oklch(0.606 0.25 292.717)",
	chart3: "oklch(0.541 0.281 293.009)",
	chart4: "oklch(0.491 0.27 292.581)",
	chart5: "oklch(0.432 0.232 292.759)",
	sidebar: "oklch(0.985 0 0)",
	sidebarForeground: "oklch(0.141 0.005 285.823)",
	sidebarPrimary: "oklch(0.541 0.281 293.009)",
	sidebarPrimaryForeground: "oklch(0.969 0.016 293.756)",
	sidebarAccent: "oklch(0.967 0.001 286.375)",
	sidebarAccentForeground: "oklch(0.21 0.006 285.885)",
	sidebarBorder: "oklch(0.92 0.004 286.32)",
	sidebarRing: "oklch(0.705 0.015 286.067)",
};

const semanticDark: typeof semanticLight = {
	background: "oklch(0.141 0.005 285.823)",
	foreground: "oklch(0.985 0 0)",
	card: "oklch(15.527% 0.0042 285.899)",
	cardForeground: "oklch(0.985 0 0)",
	popover: "oklch(0.21 0.006 285.885)",
	popoverForeground: "oklch(0.985 0 0)",
	primary: "oklch(0.606 0.25 292.717)",
	primaryForeground: "oklch(0.969 0.016 293.756)",
	secondary: "oklch(0.274 0.006 286.033)",
	secondaryForeground: "oklch(0.985 0 0)",
	muted: "oklch(0.274 0.006 286.033)",
	mutedForeground: "oklch(0.705 0.015 286.067)",
	accent: "oklch(0.274 0.006 286.033)",
	accentForeground: "oklch(0.985 0 0)",
	destructive: "oklch(0.704 0.191 22.216)",
	border: "oklch(1 0 0 / 10%)",
	input: "oklch(1 0 0 / 15%)",
	ring: "oklch(0.552 0.016 285.938)",
	chart1: "oklch(0.811 0.111 293.571)",
	chart2: "oklch(0.606 0.25 292.717)",
	chart3: "oklch(0.541 0.281 293.009)",
	chart4: "oklch(0.491 0.27 292.581)",
	chart5: "oklch(0.432 0.232 292.759)",
	sidebar: "oklch(0.21 0.006 285.885)",
	sidebarForeground: "oklch(0.985 0 0)",
	sidebarPrimary: "oklch(0.606 0.25 292.717)",
	sidebarPrimaryForeground: "oklch(0.969 0.016 293.756)",
	sidebarAccent: "oklch(0.274 0.006 286.033)",
	sidebarAccentForeground: "oklch(0.985 0 0)",
	sidebarBorder: "oklch(1 0 0 / 10%)",
	sidebarRing: "oklch(0.552 0.016 285.938)",
};

/** Mobile-only chrome, promoted into the shared tree. */
const chromeLight = {
	buttonPrimary: "oklch(46.725% 0.3001 271.689)",
	backgroundSelected: "oklch(91.042% 0.0068 277.156)",
	segmentTrack: "oklch(96.743% 0.0013 286.375)",
	segmentThumb: "oklch(1 0 0)",
	segmentThumbBorder: "oklch(0 0 0 / 8%)",
	splashBackground: "oklch(98.817% 0.0041 271.37)",
	sessionBorder: "oklch(0.92 0.004 286.32)",
	sessionSurface: "oklch(0.967 0.001 286.375)",
};

const chromeDark: typeof chromeLight = {
	buttonPrimary: "oklch(48.411% 0.2944 274.951)",
	backgroundSelected: "oklch(31.177% 0.0083 255.56)",
	segmentTrack: "oklch(1 0 0 / 4%)",
	segmentThumb: "oklch(1 0 0 / 9%)",
	segmentThumbBorder: "oklch(1 0 0 / 6%)",
	splashBackground: "oklch(21.426% 0.0702 261.842)",
	sessionBorder: "oklch(1 0 0 / 8%)",
	sessionSurface: "oklch(1 0 0 / 3.5%)",
};

const roleLight = {
	owner: "oklch(55.528% 0.1455 48.998)",
	editor: "oklch(50.813% 0.1049 165.612)",
	member: "oklch(48.82% 0.2172 264.376)",
	viewer: "oklch(55.439% 0.0407 257.417)",
};

const roleDark: typeof roleLight = {
	owner: "oklch(83.686% 0.1644 84.429)",
	editor: "oklch(77.294% 0.1535 163.223)",
	member: "oklch(71.374% 0.1434 254.624)",
	viewer: "oklch(71.067% 0.0351 256.788)",
};

const glowToken = (
	text: string,
	solid: string,
	radialHue: string,
	backgroundAlpha: number,
	borderAlpha: number
): GlowToneTokens => ({
	text,
	solid,
	background: withAlpha(solid, backgroundAlpha),
	border: withAlpha(solid, borderAlpha),
	radial: withAlpha(radialHue, glowIntensity),
});

const glowLight = {
	red: glowToken(palette.red[600], palette.red[500], palette.red[500], 0.1, 0.2),
	blue: glowToken(palette.blue[600], palette.blue[500], palette.blue[500], 0.1, 0.2),
	emerald: glowToken(palette.emerald[600], palette.emerald[500], palette.emerald[500], 0.1, 0.2),
	amber: glowToken(palette.amber[600], palette.amber[500], palette.amber[500], 0.1, 0.2),
	purple: glowToken(palette.purple[600], palette.purple[500], palette.purple[500], 0.1, 0.2),
	pink: glowToken(palette.pink[600], palette.pink[500], palette.pink[500], 0.1, 0.2),
};

const glowDark: typeof glowLight = {
	red: glowToken(palette.red[300], palette.red[600], palette.red[500], 0.2, 0.3),
	blue: glowToken(palette.blue[300], palette.blue[600], palette.blue[500], 0.2, 0.3),
	emerald: glowToken(palette.emerald[300], palette.emerald[600], palette.emerald[500], 0.2, 0.3),
	amber: glowToken(palette.amber[300], palette.amber[600], palette.amber[500], 0.2, 0.3),
	purple: glowToken(palette.purple[300], palette.purple[600], palette.purple[500], 0.2, 0.3),
	pink: glowToken(palette.pink[300], palette.pink[600], palette.pink[500], 0.2, 0.3),
};

/**
 * Mode-invariant tokens, authored once and spread into both modes. Status
 * families adopt web's Tailwind values; `role` is the mobile-only exception
 * and is authored per mode above.
 */
const domain = {
	divider: "oklch(60% 0 0 / 25%)",
	dividerBorder: "oklch(60% 0 0 / 30%)",
	dividerStrong: "oklch(60% 0 0 / 50%)",
	overlay: "oklch(0 0 0 / 50%)",
	overlaySoft: "oklch(0 0 0 / 40%)",
	vignette: "oklch(0 0 0 / 80%)",
	faint: "oklch(71.366% 0.0192 261.325)",
	warning: "oklch(66.584% 0.1574 58.318)",
	link: "oklch(63.45% 0.1834 258.558)",
	brandFrom: "oklch(69.025% 0.1669 250.913)",
	brandTo: "oklch(56.662% 0.1846 254.829)",
	form: {
		win: "oklch(62.705% 0.1699 149.214)",
		draw: "oklch(66.584% 0.1574 58.318)",
		loss: "oklch(57.71% 0.2152 27.325)",
	},
	seasonStatus: {
		active: { text: palette.green[600], solid: palette.green[500] },
		upcoming: { text: palette.blue[600], solid: palette.blue[500] },
		ended: { text: palette.amber[600], solid: palette.amber[500] },
		locked: { text: palette.gray[500], solid: palette.gray[500] },
		archived: { text: palette.gray[500], solid: palette.gray[400] },
	},
	invitationStatus: {
		pending: { text: palette.yellow[600], solid: palette.yellow[500] },
		accepted: { text: palette.green[600], solid: palette.green[500] },
		rejected: { text: palette.red[600], solid: palette.red[500] },
		canceled: { text: palette.gray[500], solid: palette.gray[500] },
	},
	scoreType: {
		elo: { text: palette.emerald[500], solid: palette.emerald[500] },
		threeOneZero: { text: palette.blue[500], solid: palette.blue[500] },
		oneVnElo: { text: palette.purple[500], solid: palette.purple[500] },
	},
	chartSeries: {
		a: "oklch(62.308% 0.188 259.815)",
		b: "oklch(64.503% 0.2154 16.439)",
	},
	confetti: [
		palette.orange[500],
		palette.green[500],
		palette.blue[500],
		palette.yellow[500],
		palette.purple[500],
		palette.pink[500],
		palette.cyan[500],
	],
	streak: {
		fire: [
			"oklch(86.521% 0.1768 90.382)",
			"oklch(70.092% 0.2012 44.767)",
			"oklch(75.054% 0.1791 58.283)",
			"oklch(66.02% 0.2294 35.403)",
		],
		ice: [
			"oklch(96.173% 0.0264 220.63)",
			"oklch(81.482% 0.0819 225.754)",
			"oklch(75.535% 0.1534 231.639)",
			"oklch(88.346% 0.0657 236.816)",
		],
	},
};

const avatarTone = (hue: keyof typeof palette): AvatarTone => {
	const step = palette[hue] as Record<string, string>;
	const solid = step["500"];
	return {
		background: withAlpha(solid, 0.1),
		text: step["600"],
		border: withAlpha(solid, 0.2),
	};
};

/** Web's hue order (djb2 hash order in `selectAvatarIndex`). */
export const avatar = [
	avatarTone("emerald"),
	avatarTone("blue"),
	avatarTone("amber"),
	avatarTone("purple"),
	avatarTone("rose"),
	avatarTone("cyan"),
	avatarTone("orange"),
	avatarTone("indigo"),
	avatarTone("pink"),
	avatarTone("teal"),
	avatarTone("lime"),
	avatarTone("violet"),
];

export interface ThemeTokens {
	background: string;
	foreground: string;
	card: string;
	cardForeground: string;
	popover: string;
	popoverForeground: string;
	primary: string;
	primaryForeground: string;
	secondary: string;
	secondaryForeground: string;
	muted: string;
	mutedForeground: string;
	accent: string;
	accentForeground: string;
	destructive: string;
	border: string;
	input: string;
	ring: string;
	chart1: string;
	chart2: string;
	chart3: string;
	chart4: string;
	chart5: string;
	sidebar: string;
	sidebarForeground: string;
	sidebarPrimary: string;
	sidebarPrimaryForeground: string;
	sidebarAccent: string;
	sidebarAccentForeground: string;
	sidebarBorder: string;
	sidebarRing: string;
	buttonPrimary: string;
	backgroundSelected: string;
	segmentTrack: string;
	segmentThumb: string;
	segmentThumbBorder: string;
	splashBackground: string;
	sessionBorder: string;
	sessionSurface: string;
	glow: typeof glowLight;
	role: typeof roleLight;
	divider: string;
	dividerBorder: string;
	dividerStrong: string;
	overlay: string;
	overlaySoft: string;
	vignette: string;
	faint: string;
	warning: string;
	link: string;
	brandFrom: string;
	brandTo: string;
	form: typeof domain.form;
	seasonStatus: typeof domain.seasonStatus;
	invitationStatus: typeof domain.invitationStatus;
	scoreType: typeof domain.scoreType;
	chartSeries: typeof domain.chartSeries;
	confetti: typeof domain.confetti;
	streak: typeof domain.streak;
	avatar: typeof avatar;
}

export const themes: Record<ThemeMode, ThemeTokens> = {
	light: {
		...semanticLight,
		...chromeLight,
		...domain,
		avatar,
		role: roleLight,
		glow: glowLight,
	},
	dark: {
		...semanticDark,
		...chromeDark,
		...domain,
		avatar,
		role: roleDark,
		glow: glowDark,
	},
};

export type GlowTone = keyof ThemeTokens["glow"];
