import type { IconSvgElement } from "@hugeicons/react";
import {
	ArrowLeftRightIcon,
	CrownIcon,
	Fire02Icon,
	Fire03Icon,
	FireIcon,
	Shield01Icon,
	Shield02Icon,
	ShieldEnergyIcon,
	Target01Icon,
	Target02Icon,
	Target03Icon,
} from "@hugeicons/core-free-icons";
import type { AchievementIconKey } from "@coding-cowboys/scorebrawl-core/achievements";

export const achievementIcons: Record<AchievementIconKey, IconSvgElement> = {
	"fire-1": FireIcon,
	"fire-2": Fire02Icon,
	"fire-3": Fire03Icon,
	redemption: ArrowLeftRightIcon,
	"shield-1": Shield01Icon,
	"shield-2": Shield02Icon,
	"shield-3": ShieldEnergyIcon,
	"target-1": Target01Icon,
	"target-2": Target02Icon,
	"target-3": Target03Icon,
	crown: CrownIcon,
};
