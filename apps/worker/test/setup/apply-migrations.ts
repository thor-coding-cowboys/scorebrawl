import { applyD1Migrations, env } from "cloudflare:test";
import { beforeEach } from "vitest";
import { clearAuthInstanceCache } from "../../src/lib/auth-instance";

// applyD1Migrations() only applies migrations that haven't already been applied,
// therefore it is safe to call this function in the setup file.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// Isolated storage rolls back each test, but a cached auth instance keeps plugin
// state (e.g. seeded OAuth resources) from the test that built it.
beforeEach(() => {
	clearAuthInstanceCache();
});
