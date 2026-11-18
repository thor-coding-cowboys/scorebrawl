import { describe, expect, it } from "vitest";
import { isMcpAuthPath, needsMcpAuthInstance } from "../../src/lib/auth-mcp-paths";

describe("isMcpAuthPath", () => {
	it("routes the OAuth 2.1 and discovery endpoints to the MCP instance", () => {
		expect(isMcpAuthPath("/api/auth/oauth2/authorize")).toBe(true);
		expect(isMcpAuthPath("/api/auth/oauth2/token")).toBe(true);
		expect(isMcpAuthPath("/api/auth/oauth2/consent")).toBe(true);
		expect(isMcpAuthPath("/api/auth/admin/oauth2/create-client")).toBe(true);
		expect(isMcpAuthPath("/api/auth/.well-known/openid-configuration")).toBe(true);
		expect(isMcpAuthPath("/api/auth/.well-known/oauth-authorization-server")).toBe(true);
	});

	it("routes the endpoints that resume a pending authorization", () => {
		expect(isMcpAuthPath("/api/auth/sign-in/social")).toBe(true);
		expect(isMcpAuthPath("/api/auth/sign-up/email")).toBe(true);
		expect(isMcpAuthPath("/api/auth/callback/google")).toBe(true);
		// The web client attaches oauth_query to passkey verification too.
		expect(isMcpAuthPath("/api/auth/passkey/verify-authentication")).toBe(true);
	});

	it("leaves ordinary app auth on the lean instance", () => {
		expect(isMcpAuthPath("/api/auth/get-session")).toBe(false);
		expect(isMcpAuthPath("/api/auth/jwks")).toBe(false);
		expect(isMcpAuthPath("/api/auth/sign-out")).toBe(false);
		expect(isMcpAuthPath("/api/auth/organization/list")).toBe(false);
		expect(isMcpAuthPath("/api/auth/api-key/list")).toBe(false);
		expect(isMcpAuthPath("/api/auth/device/code")).toBe(false);
	});
});

describe("needsMcpAuthInstance", () => {
	it("includes the well-known documents forwarded to the auth handler", () => {
		expect(needsMcpAuthInstance("/.well-known/oauth-protected-resource")).toBe(true);
		expect(needsMcpAuthInstance("/.well-known/oauth-protected-resource/mcp")).toBe(true);
		expect(needsMcpAuthInstance("/.well-known/oauth-authorization-server")).toBe(true);
		expect(needsMcpAuthInstance("/.well-known/openid-configuration")).toBe(true);
	});

	it("leaves every other path on the lean instance", () => {
		expect(needsMcpAuthInstance("/api/auth/get-session")).toBe(false);
		expect(needsMcpAuthInstance("/mcp")).toBe(false);
		expect(needsMcpAuthInstance("/.well-known/security.txt")).toBe(false);
	});
});
