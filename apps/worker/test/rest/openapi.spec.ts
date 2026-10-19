import { describe, expect, it } from "vitest";
import { SELF } from "cloudflare:test";

type Operation = {
	security?: unknown;
	requestBody?: { content?: { "application/json": { schema?: unknown } } };
	responses: Record<string, { content?: { "application/json": { schema?: unknown } } }>;
};

type OpenApiDocument = {
	openapi?: string;
	info?: { title?: string; version?: string };
	paths: Record<string, unknown>;
	components?: {
		securitySchemes?: Record<string, unknown>;
		schemas?: Record<
			string,
			{ type?: unknown; required?: unknown; properties?: Record<string, unknown> }
		>;
	};
};

async function fetchDocument() {
	const res = await fetchSpec("https://api.scorebrawl.com");
	return (await res.json()) as OpenApiDocument;
}

function operation(doc: OpenApiDocument, path: string, method: string) {
	return (doc.paths[path] as Record<string, Operation | undefined>)[method];
}

function responseRef(doc: OpenApiDocument, path: string, method: string, status: string) {
	return operation(doc, path, method)?.responses[status]?.content?.["application/json"].schema;
}

function requestRef(doc: OpenApiDocument, path: string, method: string) {
	return operation(doc, path, method)?.requestBody?.content?.["application/json"].schema;
}

async function fetchSpec(host: "https://api.scorebrawl.com" | "https://scorebrawl.com") {
	return SELF.fetch(`${host}/v1/openapi.json`);
}

describe("GET /v1/openapi.json", () => {
	it("serves the OpenAPI 3.1 document with open CORS on the API host", async () => {
		const res = await fetchSpec("https://api.scorebrawl.com");

		expect(res.status).toBe(200);
		expect(res.headers.get("access-control-allow-origin")).toBe("*");

		const doc = (await res.json()) as OpenApiDocument;
		expect(doc.openapi).toBe("3.1.0");
		expect(doc.info?.title).toBe("ScoreBrawl Public API");
		expect(doc.components?.securitySchemes?.apiKey).toEqual({
			type: "apiKey",
			in: "header",
			name: "x-api-key",
		});
	});

	it("does not document its own endpoint", async () => {
		const res = await fetchSpec("https://api.scorebrawl.com");
		const doc = (await res.json()) as OpenApiDocument;
		expect(doc.paths).not.toHaveProperty("/v1/openapi.json");
	});

	it("is 404 on the app host", async () => {
		const res = await fetchSpec("https://scorebrawl.com");
		expect(res.status).toBe(404);
	});
});

describe("personal endpoints", () => {
	it.each([
		["/v1/me", "MeResponse", "user"],
		["/v1/leagues", "ListLeaguesResponse", "leagues"],
	])("documents GET %s with api key security and its response ref", async (path, ref, required) => {
		const doc = await fetchDocument();
		const op = operation(doc, String(path), "get");

		expect(op).toBeDefined();
		expect(op?.security).toEqual([{ apiKey: [] }]);
		expect(responseRef(doc, String(path), "get", "200")).toEqual({
			$ref: `#/components/schemas/${ref}`,
		});
		expect(doc.components?.schemas?.[String(ref)]).toMatchObject({
			type: "object",
			required: [required],
		});
	});

	it.each(["/v1/me", "/v1/leagues"])(
		"documents the shared error responses as ApiError refs for %s",
		async (path) => {
			const doc = await fetchDocument();

			for (const status of ["400", "401", "403", "404", "429", "500"]) {
				expect(responseRef(doc, path, "get", status)).toEqual({
					$ref: "#/components/schemas/ApiError",
				});
			}
		}
	);
});

const sessionOperations = [
	{
		suffix: "/sessions",
		method: "post",
		status: "201",
		response: "StartSessionResponse",
		request: "StartSessionRequest",
	},
	{
		suffix: "/sessions/active/end",
		method: "post",
		status: "200",
		response: "EndSessionResponse",
	},
	{
		suffix: "/sessions/active/match/start",
		method: "post",
		status: "201",
		response: "StartMatchResponse",
		request: "StartMatchRequest",
	},
	{
		suffix: "/sessions/active/match/log",
		method: "post",
		status: "200",
		response: "LogMatchResponse",
		request: "ScorePairRequest",
	},
	{
		suffix: "/sessions/active/match/lineup",
		method: "put",
		status: "200",
		response: "LineupResponse",
		request: "LineupRequest",
	},
	{
		suffix: "/sessions/active/match/score",
		method: "put",
		status: "200",
		response: "ScoreResponse",
		request: "ScorePairRequest",
	},
	{
		suffix: "/sessions/active/match",
		method: "delete",
		status: "200",
		response: "CancelMatchResponse",
	},
] as const;

describe("league session endpoints", () => {
	it.each(["/leagues/v1", "/leagues/v1/{leagueId}"])(
		"documents all seven operations under %s",
		async (mount) => {
			const doc = await fetchDocument();

			for (const op of sessionOperations) {
				const path = `${mount}${op.suffix}`;
				const documented = operation(doc, path, op.method);

				expect(documented, path).toBeDefined();
				expect(documented?.security, path).toEqual([{ apiKey: [] }]);
				expect(responseRef(doc, path, op.method, op.status), path).toEqual({
					$ref: `#/components/schemas/${op.response}`,
				});
				expect(doc.components?.schemas?.[op.response], path).toBeDefined();

				if ("request" in op) {
					expect(requestRef(doc, path, op.method), path).toEqual({
						$ref: `#/components/schemas/${op.request}`,
					});
				}

				for (const status of ["400", "401", "403", "404", "409", "429", "500"]) {
					expect(responseRef(doc, path, op.method, status), `${path} ${status}`).toEqual({
						$ref: "#/components/schemas/ApiError",
					});
				}
			}
		}
	);

	it("documents timestamps as date-time strings", async () => {
		const doc = await fetchDocument();

		expect(doc.components?.schemas?.Session?.properties).toMatchObject({
			createdAt: { type: "string", format: "date-time" },
			endedAt: {
				anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
			},
		});
	});

	it("states the required scope in every operation description", async () => {
		const doc = await fetchDocument();

		const expected = [
			{ suffix: "/sessions", method: "post", scope: "session:start" },
			{ suffix: "/sessions/active/end", method: "post", scope: "session:stop" },
			{ suffix: "/sessions/active/match/start", method: "post", scope: "match:start" },
			{ suffix: "/sessions/active/match/log", method: "post", scope: "match:log" },
			{ suffix: "/sessions/active/match/lineup", method: "put", scope: "match:lineup" },
			{ suffix: "/sessions/active/match/score", method: "put", scope: "match:score" },
			{ suffix: "/sessions/active/match", method: "delete", scope: "match:cancel" },
		] as const;

		for (const { suffix, method, scope } of expected) {
			const op = operation(doc, `/leagues/v1${suffix}`, method) as
				| (Operation & { description?: string })
				| undefined;

			expect(op?.description, suffix).toContain(scope);
		}
	});
});
