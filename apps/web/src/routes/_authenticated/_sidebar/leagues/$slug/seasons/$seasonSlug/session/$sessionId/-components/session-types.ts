import type { RouterOutput } from "@/lib/trpc";

export type {
	CoinToss,
	CoinTossPhase,
	ModeSettings,
	PlayerWithTeam,
	ProposedLineup,
	SessionMatch,
	SessionPlayer,
	TeamAssignment,
} from "@coding-cowboys/scorebrawl-core/session";

export type GameSession = RouterOutput["session"]["getById"];
