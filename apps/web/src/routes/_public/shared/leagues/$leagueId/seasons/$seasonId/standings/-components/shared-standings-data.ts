export type SharedStandingRow = {
	id: string;
	rank: number;
	name: string;
	image: string | null;
	score: number;
	matchCount: number;
	winCount: number;
	lossCount: number;
	drawCount: number;
	winPct: number;
	pointDiff: number;
	form: ("W" | "D" | "L")[];
};

export type SharedMatch = {
	id: string;
	playedAt: string;
	home: { label: string; score: number };
	away: { label: string; score: number };
};

export type SharedStandingsData = {
	link: { createdAt: string; expiresAt: string | null };
	league: { id: string; name: string; logo: string | null };
	season: { id: string; name: string; startDate: string; closed: boolean; archived: boolean };
	standings: SharedStandingRow[];
	recentMatches: SharedMatch[];
	generatedAt: string;
};

export type ShareErrorCode =
	| "not_found"
	| "expired"
	| "revoked"
	| "sharing_disabled"
	| "rate_limited";

export class ShareLinkError extends Error {
	constructor(
		readonly status: number,
		readonly code: ShareErrorCode,
		readonly expiresAt: string | null = null,
		readonly revokedAt: string | null = null
	) {
		super(code);
	}
}

export async function fetchSharedStandings(key: string): Promise<SharedStandingsData> {
	const response = await fetch(`/api/share/links/${encodeURIComponent(key)}`, {
		headers: { accept: "application/json" },
	});

	if (!response.ok) {
		let body: {
			error?: { code?: ShareErrorCode };
			expiresAt?: string | null;
			revokedAt?: string | null;
		} = {};
		try {
			body = await response.json();
		} catch {
			// Non-JSON error body: fall through with the status alone.
		}
		throw new ShareLinkError(
			response.status,
			body.error?.code ?? "not_found",
			body.expiresAt ?? null,
			body.revokedAt ?? null
		);
	}

	return response.json();
}
