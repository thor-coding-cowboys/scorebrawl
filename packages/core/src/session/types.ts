export type SessionPlayer = {
	id: string;
	seasonPlayerId: string;
	displayName: string;
	playerImage: string | null;
	score: number;
	status: "waiting" | "playing" | "out";
	queuePosition: number;
	gamesPlayedThisSession: number;
	consecutiveGames: number;
	userId: string | null;
};

export type SessionMatch = {
	id: string;
	matchNumber: number;
	homePlayerIds: string[];
	awayPlayerIds: string[];
	result: "home" | "away" | "draw" | null;
	matchId: string | null;
	homeSessionScore: number;
	awaySessionScore: number;
	selectedHomePlayerIds: string[] | null;
	selectedAwayPlayerIds: string[] | null;
};

export type CoinToss = {
	id: string;
	conflictType: "loser-rotation" | "max-consecutive-exceeded" | "draw-tiebreak";
	candidates: string[];
	resolved: boolean;
};

export type ProposedLineup = {
	homePlayerIds: string[];
	awayPlayerIds: string[];
	rotatedOut: string[];
	coinTossNeeded: { conflictType: string; candidates: string[] } | null;
	selectedHomePlayerIds?: string[];
	selectedAwayPlayerIds?: string[];
} | null;

export type ModeSettings =
	| {
			mode: "winner-stays";
			maxConsecutiveGames: number | null;
			winnersTakePriority: boolean;
			randomizerType: "off" | "fisher-yates" | "diversity";
			autoCoinToss: boolean;
			alwaysSplitConstraints: [string, string][];
	  }
	| {
			mode: "manual";
			maxConsecutiveGames?: undefined;
			winnersTakePriority?: undefined;
			randomizerType?: undefined;
			autoCoinToss?: undefined;
			alwaysSplitConstraints?: undefined;
	  };

export type TeamAssignment = "home" | "away" | undefined;

export type PlayerWithTeam = SessionPlayer & { team?: TeamAssignment };

export type CoinTossPhase = "pick" | "flip" | "result";

export type SplitPlayer = Pick<SessionPlayer, "id" | "seasonPlayerId" | "queuePosition">;

export type GameSession = {
	players: SessionPlayer[];
	matches: SessionMatch[];
	proposedLineup: ProposedLineup;
	teamSize: number;
};
