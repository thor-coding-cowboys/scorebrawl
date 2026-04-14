export type WinnerStaysSettings = {
	mode: "winner-stays";
	maxConsecutiveGames: number | null;
	winnersTakePriority: boolean;
	autoRandomize: boolean;
	randomizerType: "fisher-yates" | "diversity";
	autoCoinToss: boolean;
	alwaysSplitConstraints: [string, string][];
};

export type ManualSettings = {
	mode: "manual";
};

export type ModeSettings = WinnerStaysSettings | ManualSettings;
