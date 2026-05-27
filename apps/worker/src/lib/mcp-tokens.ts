const TOKEN_PREFIX = "scbr_";

function base64url(bytes: Uint8Array): string {
	let str = "";
	for (const b of bytes) str += String.fromCharCode(b);
	return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBytes(n: number): Uint8Array {
	const buf = new Uint8Array(n);
	crypto.getRandomValues(buf);
	return buf;
}

export function generateToken(): string {
	return TOKEN_PREFIX + base64url(randomBytes(32));
}

export function generateAuthCode(): string {
	return base64url(randomBytes(24));
}

export async function hashToken(token: string): Promise<string> {
	const enc = new TextEncoder().encode(token);
	const digest = await crypto.subtle.digest("SHA-256", enc);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
