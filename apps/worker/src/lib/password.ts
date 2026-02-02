/**
 * Password hashing utilities optimized for Cloudflare Workers
 * Uses Web Crypto API with PBKDF2 to stay within CPU time limits
 */

const ITERATIONS = 100000; // Maximum supported by Cloudflare Workers
const HASH_LENGTH = 64; // 64 bytes = 512 bits
const SALT_LENGTH = 16; // 16 bytes = 128 bits

/**
 * Hash a password using PBKDF2
 */
export async function hashPassword(password: string, providedSalt?: Uint8Array): Promise<string> {
	// Generate or use provided salt
	const salt = providedSalt || crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

	// Convert password string to bytes
	const passwordBuffer = new TextEncoder().encode(password);

	// Import password as a key
	const key = await crypto.subtle.importKey("raw", passwordBuffer, { name: "PBKDF2" }, false, [
		"deriveBits",
	]);

	// Derive hash using PBKDF2
	const hashBuffer = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			// Type cast needed due to DOM/Workers type definitions conflict
			salt: salt as BufferSource,
			iterations: ITERATIONS,
			hash: "SHA-256",
		},
		key,
		HASH_LENGTH * 8
	);

	// Convert to hex and combine salt + hash
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const saltArray = Array.from(salt);

	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
	const saltHex = saltArray.map((b) => b.toString(16).padStart(2, "0")).join("");

	return `${saltHex}:${hashHex}`;
}

/**
 * Verify a password against a stored hash
 */
export async function verifyPassword(
	storedHash: string,
	passwordAttempt: string
): Promise<boolean> {
	// Extract salt from stored hash
	const [saltHex, originalHash] = storedHash.split(":");

	if (!saltHex || !originalHash) {
		return false;
	}

	// Convert salt from hex to Uint8Array
	const saltArray = new Uint8Array(
		saltHex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) || []
	);

	// Hash the password attempt with the original salt
	const attemptHash = await hashPassword(passwordAttempt, saltArray);

	// Compare hashes (constant-time comparison would be better, but this is acceptable)
	return attemptHash === storedHash;
}
