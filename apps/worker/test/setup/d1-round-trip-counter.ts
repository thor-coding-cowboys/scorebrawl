import { getDb } from "../../src/db";

export interface RoundTripCounter {
	db: ReturnType<typeof getDb>;
	count: () => number;
	reset: () => void;
}

/**
 * Wraps a D1 binding so each statement execution (run/all/first/raw) and each
 * batch() call counts as exactly one round trip. Used to prove database access
 * is batched rather than one-statement-per-round-trip.
 */
export function createRoundTripCounter(d1: D1Database): RoundTripCounter {
	let roundTrips = 0;
	const realStatements = new WeakMap<object, D1PreparedStatement>();

	const wrapStatement = (statement: D1PreparedStatement): D1PreparedStatement => {
		const proxy = new Proxy(statement, {
			get(target, prop) {
				if (prop === "bind") {
					return (...values: unknown[]) =>
						wrapStatement((target.bind as (...v: unknown[]) => D1PreparedStatement)(...values));
				}
				if (prop === "run" || prop === "all" || prop === "first" || prop === "raw") {
					const method = Reflect.get(target, prop) as (...args: unknown[]) => Promise<unknown>;
					return (...args: unknown[]) => {
						roundTrips++;
						return method.apply(target, args);
					};
				}
				const value = Reflect.get(target, prop);
				return typeof value === "function" ? value.bind(target) : value;
			},
		}) as D1PreparedStatement;
		realStatements.set(proxy, statement);
		return proxy;
	};

	const wrapped = new Proxy(d1, {
		get(target, prop) {
			if (prop === "prepare") {
				return (query: string) => wrapStatement(target.prepare(query));
			}
			if (prop === "batch") {
				return (statements: D1PreparedStatement[]) => {
					roundTrips++;
					return target.batch(statements.map((s) => realStatements.get(s as object) ?? s));
				};
			}
			if (prop === "exec") {
				return (query: string) => {
					roundTrips++;
					return target.exec(query);
				};
			}
			const value = Reflect.get(target, prop);
			return typeof value === "function" ? value.bind(target) : value;
		},
	}) as D1Database;

	return {
		db: getDb(wrapped),
		count: () => roundTrips,
		reset: () => {
			roundTrips = 0;
		},
	};
}
