#!/usr/bin/env bun
import { statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "../../mobile/dist");
const port = Number(process.env.MOBILE_E2E_WEB_PORT ?? 8081);

const isFile = (path: string) => {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
};

// The static export writes one HTML file per route. Deep links are resolved by
// trying the other common shapes before falling back to the root document, which
// leaves expo-router to route client-side.
function resolveFile(requestPath: string) {
	const clean = decodeURIComponent(requestPath).replace(/\/+$/, "");
	const candidates = [`${clean}.html`, `${clean}/index.html`, clean, "/index.html"];

	for (const candidate of candidates) {
		const file = resolve(root, `.${candidate}`);
		if (!file.startsWith(root)) continue;
		if (isFile(file)) return file;
	}

	return null;
}

const server = Bun.serve({
	port,
	fetch(request) {
		const file = resolveFile(new URL(request.url).pathname);

		if (!file) {
			return new Response("Not found", { status: 404 });
		}

		return new Response(Bun.file(file), { headers: { "cache-control": "no-store" } });
	},
});

console.log(`mobile web → http://localhost:${server.port} (${root})`);
