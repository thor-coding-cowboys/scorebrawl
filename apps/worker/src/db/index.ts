import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb(d1: D1Database) {
	return drizzle(d1, { schema });
}

export type DrizzleDB = ReturnType<typeof getDb>;
export type TransactionClient = Parameters<Parameters<DrizzleDB["transaction"]>[0]>[0];

/**
 * Helper to run operations in a transaction with fallback for environments that don't support transactions.
 * In production D1, this uses proper transactions. In local/test D1, this falls back to non-transactional mode.
 */
export async function withTransaction<T>(
	db: DrizzleDB,
	callback: (tx: TransactionClient | DrizzleDB) => Promise<T>
): Promise<T> {
	try {
		// Try to use a transaction
		return await db.transaction(callback);
	} catch (error) {
		// If transactions aren't supported (D1 local), fall back to non-transactional
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (errorMessage.includes("begin") || errorMessage.includes("transaction")) {
			// Fall back to non-transactional mode
			return callback(db);
		}
		// Re-throw other errors
		throw error;
	}
}

export * from "./schema";
