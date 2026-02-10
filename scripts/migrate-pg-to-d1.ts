/**
 * Migration script: PostgreSQL -> SQLite/D1
 *
 * Usage:
 *   DATABASE_URL=postgresql://... bun scripts/migrate-pg-to-d1.ts --sqlite-path /path/to/db.sqlite
 *   DATABASE_URL=postgresql://... bun scripts/migrate-pg-to-d1.ts --sqlite-path /path/to/db.sqlite --dry-run
 *
 * The SQLite database must already have the D1 schema applied (via wrangler migrations).
 */

import { Database } from "bun:sqlite";
import pg from "pg";

// ── Config ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const sqlitePathIdx = args.indexOf("--sqlite-path");
const sqlitePath = sqlitePathIdx !== -1 ? args[sqlitePathIdx + 1] : undefined;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	console.error("Missing DATABASE_URL environment variable");
	process.exit(1);
}

if (!sqlitePath) {
	console.error("Missing --sqlite-path argument");
	process.exit(1);
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Convert PG timestamp string to unix epoch milliseconds */
function tsToMs(ts: string | null): number | null {
	if (!ts) return null;
	return new Date(ts + "Z").getTime();
}

/** Convert PG timestamp string to unix epoch seconds */
function tsToSec(ts: string | null): number | null {
	if (!ts) return null;
	return Math.floor(new Date(ts + "Z").getTime() / 1000);
}

/** Convert PG boolean to SQLite integer (0/1) */
function boolToInt(val: boolean | null): number | null {
	if (val === null || val === undefined) return null;
	return val ? 1 : 0;
}

function logEntity(name: string, count: number) {
	const label = dryRun ? "Would insert" : "Inserted";
	console.log(`  ${label} ${count} rows into ${name}`);
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
	console.log(`Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
	console.log(`Source: ${databaseUrl}`);
	console.log(`Target: ${sqlitePath}\n`);

	const pgClient = new pg.Client({ connectionString: databaseUrl });
	await pgClient.connect();

	const sqlite = new Database(sqlitePath!, { readwrite: true, create: false });
	sqlite.exec("PRAGMA journal_mode = WAL");
	sqlite.exec("PRAGMA foreign_keys = OFF"); // disable during migration

	try {
		if (!dryRun) {
			sqlite.exec("BEGIN TRANSACTION");
		}

		// 1. user
		await migrateUser(pgClient, sqlite);

		// 2. user_preference (derived from user.default_league_id)
		await migrateUserPreference(pgClient, sqlite);

		// 3. account
		await migrateAccount(pgClient, sqlite);

		// 4. verification
		await migrateVerification(pgClient, sqlite);

		// 5. league
		await migrateLeague(pgClient, sqlite);

		// 6. member (from league_member)
		await migrateMember(pgClient, sqlite);

		// 7. player (from league_player)
		await migratePlayer(pgClient, sqlite);

		// 8. player_achievement (from league_player_achievement)
		await migratePlayerAchievement(pgClient, sqlite);

		// 9. league_team (from league_team)
		await migrateLeagueTeam(pgClient, sqlite);

		// 10. league_team_player (from league_team_player)
		await migrateLeagueTeamPlayer(pgClient, sqlite);

		// 11. season
		await migrateSeason(pgClient, sqlite);

		// 12. season_player
		await migrateSeasonPlayer(pgClient, sqlite);

		// 13. season_team
		await migrateSeasonTeam(pgClient, sqlite);

		// 14. match
		await migrateMatch(pgClient, sqlite);

		// 15. match_player
		await migrateMatchPlayer(pgClient, sqlite);

		// 16. match_team (from season_team_match)
		await migrateMatchTeam(pgClient, sqlite);

		// 17. fixture (from season_fixture)
		await migrateFixture(pgClient, sqlite);

		if (!dryRun) {
			sqlite.exec("COMMIT");
			console.log("\nMigration committed successfully.");
		} else {
			console.log("\nDry run complete. No data was written.");
		}
	} catch (err) {
		if (!dryRun) {
			sqlite.exec("ROLLBACK");
		}
		console.error("\nMigration failed:", err);
		process.exit(1);
	} finally {
		sqlite.exec("PRAGMA foreign_keys = ON");
		sqlite.close();
		await pgClient.end();
	}
}

// ── Entity Migrations ───────────────────────────────────────────────

async function migrateUser(pgClient: pg.Client, sqlite: Database) {
	const { rows } = await pgClient.query(
		'SELECT id, name, email, email_verified, image, created_at, updated_at FROM "user"'
	);
	logEntity("user", rows.length);
	if (dryRun) return;

	const stmt = sqlite.prepare(
		"INSERT INTO user (id, name, email, email_verified, image, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
	);
	for (const r of rows) {
		stmt.run(
			r.id,
			r.name,
			r.email ?? `unknown+${r.id}@placeholder.com`,
			boolToInt(r.email_verified) ?? 0,
			r.image,
			tsToMs(r.created_at),
			tsToMs(r.updated_at)
		);
	}
}

async function migrateUserPreference(pgClient: pg.Client, sqlite: Database) {
	const { rows } = await pgClient.query(
		'SELECT id, default_league_id, created_at FROM "user" WHERE default_league_id IS NOT NULL'
	);
	logEntity("user_preference", rows.length);
	if (dryRun) return;

	const stmt = sqlite.prepare(
		"INSERT INTO user_preference (user_id, default_organization_id, created_at, updated_at) VALUES (?, ?, ?, ?)"
	);
	for (const r of rows) {
		const ts = tsToSec(r.created_at);
		stmt.run(r.id, r.default_league_id, ts, ts);
	}
}

async function migrateAccount(pgClient: pg.Client, sqlite: Database) {
	const { rows } = await pgClient.query(
		"SELECT id, account_id, provider_id, user_id, access_token, refresh_token, id_token, access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at FROM account"
	);
	logEntity("account", rows.length);
	if (dryRun) return;

	const stmt = sqlite.prepare(
		"INSERT INTO account (id, account_id, provider_id, user_id, access_token, refresh_token, id_token, access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
	);
	for (const r of rows) {
		stmt.run(
			r.id,
			r.account_id,
			r.provider_id,
			r.user_id,
			r.access_token,
			r.refresh_token,
			r.id_token,
			tsToMs(r.access_token_expires_at),
			tsToMs(r.refresh_token_expires_at),
			r.scope,
			r.password,
			tsToMs(r.created_at),
			tsToMs(r.updated_at)
		);
	}
}

async function migrateVerification(pgClient: pg.Client, sqlite: Database) {
	const { rows } = await pgClient.query(
		"SELECT id, identifier, value, expires_at, created_at, updated_at FROM verification"
	);
	logEntity("verification", rows.length);
	if (dryRun) return;

	const stmt = sqlite.prepare(
		"INSERT INTO verification (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
	);
	for (const r of rows) {
		stmt.run(
			r.id,
			r.identifier,
			r.value,
			tsToMs(r.expires_at),
			tsToMs(r.created_at) ?? Date.now(),
			tsToMs(r.updated_at) ?? Date.now()
		);
	}
}

async function migrateLeague(pgClient: pg.Client, sqlite: Database) {
	const { rows } = await pgClient.query(
		"SELECT id, name, name_slug, logo_url, created_at FROM league"
	);
	logEntity("league", rows.length);
	if (dryRun) return;

	const stmt = sqlite.prepare(
		"INSERT INTO league (id, name, slug, logo, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?)"
	);
	for (const r of rows) {
		stmt.run(r.id, r.name, r.name_slug, r.logo_url, tsToMs(r.created_at), null);
	}
}

async function migrateMember(pgClient: pg.Client, sqlite: Database) {
	const { rows } = await pgClient.query(
		"SELECT id, league_id, user_id, role, created_at FROM league_member"
	);
	logEntity("member", rows.length);
	if (dryRun) return;

	const stmt = sqlite.prepare(
		"INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)"
	);
	for (const r of rows) {
		stmt.run(r.id, r.league_id, r.user_id, r.role, tsToMs(r.created_at));
	}
}

async function migratePlayer(pgClient: pg.Client, sqlite: Database) {
	const { rows } = await pgClient.query(
		"SELECT id, user_id, league_id, disabled, created_at, updated_at FROM league_player"
	);
	logEntity("player", rows.length);
	if (dryRun) return;

	const stmt = sqlite.prepare(
		"INSERT INTO player (id, user_id, league_id, disabled, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
	);
	for (const r of rows) {
		stmt.run(
			r.id,
			r.user_id,
			r.league_id,
			boolToInt(r.disabled),
			tsToSec(r.created_at),
			tsToSec(r.updated_at),
			null
		);
	}
}

async function migratePlayerAchievement(pgClient: pg.Client, sqlite: Database) {
	const { rows } = await pgClient.query(
		"SELECT id, league_player_id, type_id, created_at, updated_at FROM league_player_achievement"
	);
	logEntity("player_achievement", rows.length);
	if (dryRun) return;

	const stmt = sqlite.prepare(
		"INSERT INTO player_achievement (id, player_id, type, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)"
	);
	for (const r of rows) {
		stmt.run(
			r.id,
			r.league_player_id,
			r.type_id,
			tsToSec(r.created_at),
			tsToSec(r.updated_at),
			null
		);
	}
}

async function migrateLeagueTeam(pgClient: pg.Client, sqlite: Database) {
	const { rows } = await pgClient.query(
		"SELECT id, name, league_id, created_at, updated_at FROM league_team"
	);
	logEntity("league_team", rows.length);
	if (dryRun) return;

	const stmt = sqlite.prepare(
		"INSERT INTO league_team (id, name, league_id, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)"
	);
	for (const r of rows) {
		stmt.run(r.id, r.name, r.league_id, tsToSec(r.created_at), tsToSec(r.updated_at), null);
	}
}

async function migrateLeagueTeamPlayer(pgClient: pg.Client, sqlite: Database) {
	const { rows } = await pgClient.query(
		"SELECT id, league_player_id, team_id, created_at, updated_at FROM league_team_player"
	);
	logEntity("league_team_player", rows.length);
	if (dryRun) return;

	const stmt = sqlite.prepare(
		"INSERT INTO league_team_player (id, player_id, league_team_id, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)"
	);
	for (const r of rows) {
		stmt.run(
			r.id,
			r.league_player_id,
			r.team_id,
			tsToSec(r.created_at),
			tsToSec(r.updated_at),
			null
		);
	}
}

async function migrateSeason(pgClient: pg.Client, sqlite: Database) {
	const { rows } = await pgClient.query(
		"SELECT id, name, name_slug, initial_score, score_type, k_factor, start_date, end_date, rounds, league_id, closed, created_by, updated_by, created_at, updated_at FROM season"
	);
	logEntity("season", rows.length);
	if (dryRun) return;

	const stmt = sqlite.prepare(
		"INSERT INTO season (id, name, slug, initial_score, score_type, k_factor, start_date, end_date, rounds, league_id, archived, closed, created_by, updated_by, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
	);
	for (const r of rows) {
		stmt.run(
			r.id,
			r.name,
			r.name_slug,
			r.initial_score,
			r.score_type,
			r.k_factor,
			tsToSec(r.start_date),
			tsToSec(r.end_date),
			r.rounds,
			r.league_id,
			0, // archived defaults to false (PG had no archived column)
			boolToInt(r.closed),
			r.created_by,
			r.updated_by,
			tsToSec(r.created_at),
			tsToSec(r.updated_at),
			null
		);
	}
}

async function migrateSeasonPlayer(pgClient: pg.Client, sqlite: Database) {
	const { rows } = await pgClient.query(
		"SELECT id, season_id, league_player_id, score, disabled, created_at, updated_at FROM season_player"
	);
	logEntity("season_player", rows.length);
	if (dryRun) return;

	const stmt = sqlite.prepare(
		"INSERT INTO season_player (id, season_id, player_id, score, disabled, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
	);
	for (const r of rows) {
		stmt.run(
			r.id,
			r.season_id,
			r.league_player_id,
			r.score,
			boolToInt(r.disabled),
			tsToSec(r.created_at),
			tsToSec(r.updated_at),
			null
		);
	}
}

async function migrateSeasonTeam(pgClient: pg.Client, sqlite: Database) {
	const { rows } = await pgClient.query(
		"SELECT id, season_id, team_id, score, created_at, updated_at FROM season_team"
	);
	logEntity("season_team", rows.length);
	if (dryRun) return;

	const stmt = sqlite.prepare(
		"INSERT INTO season_team (id, season_id, league_team_id, score, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
	);
	for (const r of rows) {
		stmt.run(
			r.id,
			r.season_id,
			r.team_id,
			r.score,
			tsToSec(r.created_at),
			tsToSec(r.updated_at),
			null
		);
	}
}

async function migrateMatch(pgClient: pg.Client, sqlite: Database) {
	const { rows } = await pgClient.query(
		"SELECT id, season_id, home_score, away_score, home_expected_elo, away_expected_elo, created_by, updated_by, created_at, updated_at FROM match"
	);
	logEntity("match", rows.length);
	if (dryRun) return;

	const stmt = sqlite.prepare(
		"INSERT INTO match (id, season_id, home_score, away_score, home_expected_elo, away_expected_elo, created_by, updated_by, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
	);
	for (const r of rows) {
		stmt.run(
			r.id,
			r.season_id,
			r.home_score,
			r.away_score,
			r.home_expected_elo,
			r.away_expected_elo,
			r.created_by,
			r.updated_by,
			tsToSec(r.created_at),
			tsToSec(r.updated_at),
			null
		);
	}
}

async function migrateMatchPlayer(pgClient: pg.Client, sqlite: Database) {
	const { rows } = await pgClient.query(
		"SELECT id, season_player_id, home_team, match_id, score_before, score_after, result, created_at, updated_at FROM match_player"
	);
	logEntity("match_player", rows.length);
	if (dryRun) return;

	const stmt = sqlite.prepare(
		"INSERT INTO match_player (id, season_player_id, home_team, match_id, score_before, score_after, result, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
	);
	for (const r of rows) {
		stmt.run(
			r.id,
			r.season_player_id,
			boolToInt(r.home_team),
			r.match_id,
			r.score_before,
			r.score_after,
			r.result,
			tsToSec(r.created_at),
			tsToSec(r.updated_at),
			null
		);
	}
}

async function migrateMatchTeam(pgClient: pg.Client, sqlite: Database) {
	const { rows } = await pgClient.query(
		"SELECT id, season_team_id, match_id, score_before, score_after, result, created_at, updated_at FROM season_team_match"
	);
	logEntity("match_team", rows.length);
	if (dryRun) return;

	const stmt = sqlite.prepare(
		"INSERT INTO match_team (id, season_team_id, match_id, score_before, score_after, result, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
	);
	for (const r of rows) {
		stmt.run(
			r.id,
			r.season_team_id,
			r.match_id,
			r.score_before,
			r.score_after,
			r.result,
			tsToSec(r.created_at),
			tsToSec(r.updated_at),
			null
		);
	}
}

async function migrateFixture(pgClient: pg.Client, sqlite: Database) {
	const { rows } = await pgClient.query(
		"SELECT id, round, season_id, match_id, home_player_id, away_player_id, created_at, updated_at FROM season_fixture"
	);
	logEntity("fixture", rows.length);
	if (dryRun) return;

	const stmt = sqlite.prepare(
		"INSERT INTO fixture (id, round, season_id, match_id, home_player_id, away_player_id, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
	);
	for (const r of rows) {
		stmt.run(
			r.id,
			r.round,
			r.season_id,
			r.match_id,
			r.home_player_id,
			r.away_player_id,
			tsToSec(r.created_at),
			tsToSec(r.updated_at),
			null
		);
	}
}

// ── Run ─────────────────────────────────────────────────────────────

main();
