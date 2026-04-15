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

export type ModeSettings = {
	mode: "winner-stays";
	maxConsecutiveGames: number | null;
	winnersTakePriority: boolean;
	autoRandomize: boolean;
	autoCoinToss: boolean;
	alwaysSplitConstraints: [string, string][];
} | {
	mode: "manual";
	maxConsecutiveGames?: undefined;
	winnersTakePriority?: undefined;
	autoRandomize?: undefined;
	autoCoinToss?: undefined;
	alwaysSplitConstraints?: undefined;
};

export type GameSession = {
	id: string;
	seasonId: string;
	status: "active" | "ended";
	rotationMode: "winner-stays" | "manual";
	modeSettings: ModeSettings | null;
	teamSize: number;
	proposedLineup: ProposedLineup;
	players: SessionPlayer[];
	matches: SessionMatch[];
	pendingCoinTosses: CoinToss[];
};

export type TeamAssignment = "home" | "away" | undefined;

export type PlayerWithTeam = SessionPlayer & { team?: TeamAssignment };

export type CoinTossPhase = "pick" | "flip" | "result";
