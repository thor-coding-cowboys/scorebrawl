import type { SymbolView } from "expo-symbols";
import type { AchievementIconKey } from "@coding-cowboys/scorebrawl-core/achievements";

type SymbolName = Parameters<typeof SymbolView>[0]["name"];

const FIRE: SymbolName = {
	ios: "flame.fill",
	android: "local_fire_department",
	web: "local_fire_department",
};
const REDEMPTION: SymbolName = {
	ios: "arrow.left.arrow.right",
	android: "swap_horiz",
	web: "swap_horiz",
};
const SHIELD: SymbolName = { ios: "shield.fill", android: "shield", web: "shield" };
const TARGET: SymbolName = { ios: "target", android: "track_changes", web: "track_changes" };
const CROWN: SymbolName = { ios: "crown.fill", android: "emoji_events", web: "emoji_events" };

export const achievementIcons: Record<AchievementIconKey, SymbolName> = {
	"fire-1": FIRE,
	"fire-2": FIRE,
	"fire-3": FIRE,
	redemption: REDEMPTION,
	"shield-1": SHIELD,
	"shield-2": SHIELD,
	"shield-3": SHIELD,
	"target-1": TARGET,
	"target-2": TARGET,
	"target-3": TARGET,
	crown: CROWN,
};
