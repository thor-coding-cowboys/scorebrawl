import { describe, expect, it } from "vitest";
import { corePackageName } from "./index";

describe("core", () => {
	it("exposes its package name", () => {
		expect(corePackageName).toBe("@coding-cowboys/scorebrawl-core");
	});
});
