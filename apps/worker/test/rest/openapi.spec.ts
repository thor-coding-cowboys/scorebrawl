import { describe, expect, it } from "vitest";
import { SELF } from "cloudflare:test";

type Operation = {
	security?: unknown;
	responses: Record<string, { content?: { "application/json": { schema?: unknown } } }>;
};

type OpenApiDocument = {
	openapi?: string;
	info?: { title?: string; version?: string };
	paths: Record<string, unknown>;
	components?: {
		securitySchemes?: Record<string, unknown>;
		schemas?: Record<string, Record<string, unknown>>;
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
