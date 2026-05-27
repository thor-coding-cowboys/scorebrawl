import { sql, type SQL } from "drizzle-orm";
import type { DrizzleDB } from "../../db";

const ALLOWED_TABLES = new Set([
	"match",
	"match_player",
	"player",
	"season",
	"season_player",
	"game_session",
	"session_match",
	"session_player",
	"guest",
]);

interface QueryJson {
	description: string;
	table: string;
	select?: string[];
	joins?: Array<{
		table: string;
		type?: "left" | "inner";
		on: { left: string; right: string };
	}>;
	where?: Array<{
		column: string;
		op: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "like" | "in";
		value: string | number | string[] | number[];
	}>;
	groupBy?: string[];
	orderBy?: { column: string; direction?: "asc" | "desc" };
	limit?: number;
}

function validateQuery(json: QueryJson) {
	if (!ALLOWED_TABLES.has(json.table)) {
		throw new Error(`Table '${json.table}' is not allowed`);
	}

	for (const join of json.joins ?? []) {
		if (!ALLOWED_TABLES.has(join.table)) {
			throw new Error(`Join table '${join.table}' is not allowed`);
		}
	}
}

const OPERATOR_SQL: Record<string, string> = {
	eq: "=",
	ne: "!=",
	gt: ">",
	gte: ">=",
	lt: "<",
	lte: "<=",
	like: "LIKE",
	in: "IN",
};

function sanitizeIdentifier(name: string): string {
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
		throw new Error(`Invalid identifier: ${name}`);
	}
	return name;
}

function sanitizeColumnRef(ref: string): string {
	const parts = ref.split(".");
	if (parts.length === 2) {
		return `"${sanitizeIdentifier(parts[0]!)}"."${sanitizeIdentifier(parts[1]!)}"`;
	}
	return `"${sanitizeIdentifier(ref)}"`;
}

function buildSql(query: string, params: (string | number)[]): SQL {
	const parts = query.split("?");
	if (parts.length !== params.length + 1) {
		throw new Error("Param count mismatch");
	}
	const sqlParts: SQL[] = [];
	for (let i = 0; i < parts.length; i++) {
		if (parts[i]) sqlParts.push(sql.raw(parts[i]!));
		if (i < params.length) sqlParts.push(sql`${params[i]}`);
	}
	return sql.join(sqlParts, sql``);
}

export async function executeQuery(ctx: { db: DrizzleDB }, args: { leagueId: string } & QueryJson) {
	const { db } = ctx;

	try {
		validateQuery(args);
	} catch (err) {
		return { error: err instanceof Error ? err.message : "Invalid query" };
	}

	const limit = Math.min(args.limit ?? 50, 100);

	try {
		const tableName = sanitizeIdentifier(args.table);
		const columns = args.select?.length
			? args.select.map((col) => `"${sanitizeIdentifier(col)}"`).join(", ")
			: "*";

		const joins = (args.joins ?? [])
			.map((j) => {
				const joinTable = sanitizeIdentifier(j.table);
				const joinType = j.type === "inner" ? "INNER" : "LEFT";
				return `${joinType} JOIN "${joinTable}" ON ${sanitizeColumnRef(j.on.left)} = ${sanitizeColumnRef(j.on.right)}`;
			})
			.join(" ");

		const whereClauses: string[] = [`"${tableName}".league_id = ?`];
		const params: (string | number)[] = [args.leagueId];

		for (const w of args.where ?? []) {
			const col = sanitizeIdentifier(w.column);
			const op = OPERATOR_SQL[w.op];
			if (!op) throw new Error(`Invalid operator: ${w.op}`);

			if (w.op === "in") {
				const values = Array.isArray(w.value) ? w.value : [w.value];
				const placeholders = values.map(() => "?").join(", ");
				whereClauses.push(`"${tableName}"."${col}" ${op} (${placeholders})`);
				params.push(...values.map(String));
			} else {
				whereClauses.push(`"${tableName}"."${col}" ${op} ?`);
				params.push(String(w.value));
			}
		}

		let queryStr = `SELECT ${columns} FROM "${tableName}"`;
		if (joins) queryStr += ` ${joins}`;
		queryStr += ` WHERE ${whereClauses.join(" AND ")}`;

		if (args.groupBy?.length) {
			queryStr += ` GROUP BY ${args.groupBy.map((col) => `"${sanitizeIdentifier(col)}"`).join(", ")}`;
		}

		if (args.orderBy) {
			queryStr += ` ORDER BY "${sanitizeIdentifier(args.orderBy.column)}" ${args.orderBy.direction === "asc" ? "ASC" : "DESC"}`;
		}

		queryStr += ` LIMIT ${limit}`;

		const results = await db.all(buildSql(queryStr, params));
		return { data: results };
	} catch (err) {
		return { error: err instanceof Error ? err.message : "Query execution failed" };
	}
}
