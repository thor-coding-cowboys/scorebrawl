import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { describeRoute, generateSpecs } from "hono-openapi";
import { z } from "zod";
import {
	apiResponses,
	errorResponse,
	jsonResponse,
	publicApiSpecOptions,
	respond,
} from "../../src/public-api/openapi";

type Operation = {
	responses: Record<string, { content?: { "application/json": { schema: unknown } } }>;
};

describe("respond", () => {
	const schema = z.object({ ok: z.boolean() });

	it("returns the payload after validating it", async () => {
		const app = new Hono().get("/ok", (c) => respond(c, schema, { ok: true }));

		const res = await app.request("/ok");

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});

	it("serializes a provided status", async () => {
		const app = new Hono().post("/created", (c) => respond(c, schema, { ok: true }, 201));

		expect((await app.request("/created", { method: "POST" })).status).toBe(201);
	});

	it("serializes service types (dates) to their JSON form", async () => {
		const dated = z.object({ at: z.iso.datetime() });
		const app = new Hono().get("/dated", (c) =>
			respond(c, dated, { at: new Date("2026-01-01T00:00:00.000Z") })
		);

		const res = await app.request("/dated");

		expect(await res.json()).toEqual({ at: "2026-01-01T00:00:00.000Z" });
	});

	it("returns the documented ApiError body and logs when the payload violates the schema", async () => {
		const logged = vi.spyOn(console, "error").mockImplementation(() => {});
		const app = new Hono().get("/bad", (c) => respond(c, schema, { ok: "nope" } as never));

		const res = await app.request("/bad");

		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({ error: "internal_error" });
		expect(logged).toHaveBeenCalled();
		logged.mockRestore();
	});
});

describe("apiResponses", () => {
	it("documents the success response plus the default error set", () => {
		const responses = apiResponses(
			{ 200: jsonResponse("The calling user", z.object({})) },
			{
				auth: "personal",
			}
		);

		expect(Object.keys(responses).sort()).toEqual([
			"200",
			"400",
			"401",
			"403",
			"404",
			"429",
			"500",
		]);
	});

	it("adds conflict to league responses and leaves personal responses without it", () => {
		const league = apiResponses({ 200: jsonResponse("ok", z.object({})) }, { auth: "league" });
		const personal = apiResponses({ 200: jsonResponse("ok", z.object({})) }, { auth: "personal" });

		expect(Object.keys(league)).toContain("409");
		expect(Object.keys(personal)).not.toContain("409");
	});
});

describe("publicApiSpecOptions", () => {
	const buildStub = () =>
		new Hono()
			.get(
				"/v1/thing",
				describeRoute({
					summary: "A thing",
					responses: apiResponses(
						{ 200: jsonResponse("The thing", z.object({ id: z.string() })) },
						{
							auth: "personal",
						}
					),
				}),
				(c) => c.json({ id: "1" })
			)
			.get("/v1/openapi.json", (c) => c.json({ openapi: "3.1.0" }));

	it("documents decorated routes and drops the spec endpoint", async () => {
		const doc = await generateSpecs(buildStub(), publicApiSpecOptions);

		expect(doc.paths).toHaveProperty("/v1/thing");
		expect(doc.paths).not.toHaveProperty("/v1/openapi.json");
	});

	it("exposes the api key security scheme", async () => {
		const doc = await generateSpecs(buildStub(), publicApiSpecOptions);

		expect(doc.components?.securitySchemes?.apiKey).toEqual({
			type: "apiKey",
			in: "header",
			name: "x-api-key",
		});
	});

	it("shares the error schema as an ApiError component reference", async () => {
		const stub = new Hono().get(
			"/v1/broken",
			describeRoute({ responses: { 401: errorResponse("Invalid API key") } }),
			(c) => c.json({})
		);

		const doc = await generateSpecs(stub, publicApiSpecOptions);
		const operation = doc.paths["/v1/broken"]?.get as Operation | undefined;

		expect(operation?.responses["401"]?.content?.["application/json"].schema).toEqual({
			$ref: "#/components/schemas/ApiError",
		});
		expect(doc.components?.schemas).toHaveProperty("ApiError");
	});
});
