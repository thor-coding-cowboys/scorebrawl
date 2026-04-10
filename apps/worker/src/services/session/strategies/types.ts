export type RotationMode = "winner-stays" | "manual";

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

export function exhaustiveCheck(value: never): never {
  throw new Error(`Unhandled mode: ${value}`);
}

export function parseModeSettings(json: string | null): ModeSettings | null {
  if (!json) return null;
  return JSON.parse(json) as ModeSettings;
}
