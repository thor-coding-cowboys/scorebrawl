import { createId } from "../../utils/id-util";

const IV_LENGTH = 12;
const ALGORITHM = "AES-GCM";

async function getKey(keyMaterial: string): Promise<CryptoKey> {
	const encoder = new TextEncoder();
	const data = encoder.encode(keyMaterial);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return crypto.subtle.importKey("raw", hash, { name: ALGORITHM }, false, ["encrypt", "decrypt"]);
}

export async function encryptApiKey(apiKey: string, encryptionKey: string): Promise<string> {
	const key = await getKey(encryptionKey);
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
	const encoder = new TextEncoder();
	const ciphertext = await crypto.subtle.encrypt(
		{ name: ALGORITHM, iv },
		key,
		encoder.encode(apiKey)
	);
	const combined = new Uint8Array(iv.length + ciphertext.byteLength);
	combined.set(iv);
	combined.set(new Uint8Array(ciphertext), iv.length);
	return btoa(String.fromCharCode(...combined));
}

export async function decryptApiKey(
	encryptedApiKey: string,
	encryptionKey: string
): Promise<string> {
	const key = await getKey(encryptionKey);
	const combined = Uint8Array.from(atob(encryptedApiKey), (c) => c.charCodeAt(0));
	const iv = combined.slice(0, IV_LENGTH);
	const ciphertext = combined.slice(IV_LENGTH);
	const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);
	return new TextDecoder().decode(decrypted);
}

export function generateSettingsId(): string {
	return createId();
}
