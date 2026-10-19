import { describe, expect, it } from "vitest";
import { SELF } from "cloudflare:test";

type OpenApiDocument = {
	openapi?: string;
	info?: { title?: string; version?: string };
	paths: Record<string, unknown>;
	components?: { securitySchemes?: Record<string, unknown> };
};

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
