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
		value: unknown;
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
	if (parts.length === 2 && parts[0] && parts[1]) {
		return `"${sanitizeIdentifier(parts[0]!)}"."${sanitizeIdentifier(parts[1]!)}"`;
	}
	if (parts.length === 1 && parts[0]) {
		return `"${sanitizeIdentifier(ref)}"`;
	}
	throw new Error(`Invalid column reference: ${ref}`);
}

const SAFE_SQL_FRAGMENT = /^[a-zA-Z0-9_"\s=,!<>.*()]+$/;

function assertSafeSqlFragment(fragment: string): void {
	if (fragment.includes("--")) {
		throw new Error("Unsafe SQL fragment: comment sequence detected");
	}
	if (!SAFE_SQL_FRAGMENT.test(fragment)) {
		throw new Error("Unsafe SQL fragment: unexpected characters");
	}
}

function safeRaw(fragment: string): SQL {
	assertSafeSqlFragment(fragment);
	return sql.raw(fragment);
}

function isValidValue(value: unknown): value is string | number | string[] | number[] {
	if (typeof value === "string" || typeof value === "number") return true;
	if (Array.isArray(value)) {
		return value.every((v) => typeof v === "string" || typeof v === "number");
	}
	return false;
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

		const queryParts: SQL[] = [];
		queryParts.push(sql.raw("SELECT "));

		if (args.select?.length) {
			const colParts: SQL[] = [];
			for (const col of args.select) {
				colParts.push(safeRaw(`"${sanitizeIdentifier(col)}"`));
			}
			queryParts.push(sql.join(colParts, sql.raw(", ")));
		} else {
			queryParts.push(sql.raw("*"));
		}

		queryParts.push(safeRaw(` FROM "${tableName}"`));

		for (const j of args.joins ?? []) {
			const joinTable = sanitizeIdentifier(j.table);
			const joinType = j.type === "inner" ? "INNER" : "LEFT";
			queryParts.push(
				safeRaw(
					`${joinType} JOIN "${joinTable}" ON ${sanitizeColumnRef(j.on.left)} = ${sanitizeColumnRef(j.on.right)}`
				)
			);
		}

		const whereConditions: SQL[] = [];
		whereConditions.push(
			sql.join([safeRaw(`"${tableName}".league_id = `), sql`${args.leagueId}`], sql``)
		);

		for (const w of args.where ?? []) {
			if (!isValidValue(w.value)) {
				throw new Error(`Invalid value type for column ${w.column}`);
			}

			const col = sanitizeIdentifier(w.column);
			const op = OPERATOR_SQL[w.op];
			if (!op) throw new Error(`Invalid operator: ${w.op}`);

			if (w.op === "in") {
				const values = Array.isArray(w.value) ? w.value : [w.value];
				const valueParts: SQL[] = [];
				for (const v of values) {
					valueParts.push(sql`${v}`);
				}
				whereConditions.push(
					sql.join(
						[
							safeRaw(`"${tableName}"."${col}" ${op} (`),
							sql.join(valueParts, sql.raw(", ")),
							sql.raw(")"),
						],
						sql``
					)
				);
			} else {
				whereConditions.push(
					sql.join([safeRaw(`"${tableName}"."${col}" ${op} `), sql`${w.value}`], sql``)
				);
			}
		}

		queryParts.push(sql.raw(" WHERE "));
		queryParts.push(sql.join(whereConditions, sql.raw(" AND ")));

		if (args.groupBy?.length) {
			const groupParts: SQL[] = [];
			for (const col of args.groupBy) {
				groupParts.push(safeRaw(`"${sanitizeIdentifier(col)}"`));
			}
			queryParts.push(sql.raw(" GROUP BY "));
			queryParts.push(sql.join(groupParts, sql.raw(", ")));
		}

		if (args.orderBy) {
			const direction = args.orderBy.direction === "asc" ? "ASC" : "DESC";
			queryParts.push(
				safeRaw(` ORDER BY "${sanitizeIdentifier(args.orderBy.column)}" ${direction}`)
			);
		}

		queryParts.push(sql.raw(` LIMIT ${limit}`));

		const finalQuery = sql.join(queryParts, sql``);
		const results = await db.all(finalQuery);
		return { data: results };
	} catch (err) {
		return { error: err instanceof Error ? err.message : "Query execution failed" };
	}
}
