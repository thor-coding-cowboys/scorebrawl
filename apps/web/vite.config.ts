import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
			routesDirectory: "./src/routes",
			generatedRouteTree: "./src/routeTree.gen.ts",
		}),
		viteReact(),
		tailwindcss(),
		cloudflare({
			persistState: {
				path: "../../.db/local",
			},
			configPath: "../worker/wrangler.jsonc",
		}),
	],
	resolve: {
		alias: {
			"@/components": fileURLToPath(new URL("./src/routes/-components", import.meta.url)),
			"@/lib": fileURLToPath(new URL("./src/lib", import.meta.url)),
			"@/hooks": fileURLToPath(new URL("./src/hooks", import.meta.url)),
			"@/routes": fileURLToPath(new URL("./src/routes", import.meta.url)),
			"@coding-cowboys/scorebrawl-worker": fileURLToPath(new URL("../worker/src", import.meta.url)),
		},
	},
	build: {
		outDir: "dist",
	},
	server: {
		host: true, // Bind to all interfaces (0.0.0.0) to allow access from other devices
		port: 5173,
		cors: {
			origin: (origin, callback) => {
				if (!origin) return callback(null, true);
				const { hostname } = new URL(origin);
				const allow = hostname === "localhost" || hostname.endsWith(".localhost");
				return callback(null, allow);
			},
			credentials: true,
		},
	},
});
