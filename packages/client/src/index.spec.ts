import { describe, expect, it } from "vitest";
import { clientPackageName } from "./index";

describe("client", () => {
	it("exposes its package name", () => {
		expect(clientPackageName).toBe("@coding-cowboys/scorebrawl-client");
	});
});
