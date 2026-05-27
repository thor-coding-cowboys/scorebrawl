import { sql } from "drizzle-orm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDrizzleDB = any;

const ALLOWED_TABLES = new Set([
	"match",
	"matchPlayer",
	"player",
	"season",
	"seasonPlayer",
	"gameSession",
	"sessionMatch",
	"sessionPlayer",
	"guest",
]);

const FORBIDDEN_KEYWORDS = [
	"insert",
	"update",
	"delete",
	"drop",
	"alter",
	"create",
	"truncate",
	"replace",
	"grant",
	"revoke",
	"exec",
	"execute",
];

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
	const descLower = json.description.toLowerCase();
	for (const keyword of FORBIDDEN_KEYWORDS) {
		if (descLower.includes(keyword)) {
			throw new Error(`Query description contains forbidden keyword: ${keyword}`);
		}
	}

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
	// Only allow alphanumeric, underscore
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
		throw new Error(`Invalid identifier: ${name}`);
	}
	return name;
}

export async function executeQuery(
	ctx: { db: AnyDrizzleDB },
	args: { leagueId: string } & QueryJson
) {
	const { db } = ctx;

	try {
		validateQuery(args);
	} catch (err) {
		return { error: err instanceof Error ? err.message : "Invalid query" };
	}

	const limit = Math.min(args.limit ?? 50, 100);

	try {
		const tableName = sanitizeIdentifier(args.table);
		const columns = args.select?.length ? args.select.map(sanitizeIdentifier).join(", ") : "*";

		const joins = (args.joins ?? [])
			.map((j) => {
				const joinTable = sanitizeIdentifier(j.table);
				const joinType = j.type === "inner" ? "INNER" : "LEFT";
				return `${joinType} JOIN "${joinTable}" ON ${j.on.left} = ${j.on.right}`;
			})
			.join(" ");

		// Build WHERE with parameterized values
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
			queryStr += ` GROUP BY ${args.groupBy.map(sanitizeIdentifier).join(", ")}`;
		}

		if (args.orderBy) {
			queryStr += ` ORDER BY "${sanitizeIdentifier(args.orderBy.column)}" ${args.orderBy.direction === "asc" ? "ASC" : "DESC"}`;
		}

		queryStr += ` LIMIT ${limit}`;

		const results = await db.all(sql.raw(queryStr));
		return { data: results };
	} catch (err) {
		return { error: err instanceof Error ? err.message : "Query execution failed" };
	}
}
