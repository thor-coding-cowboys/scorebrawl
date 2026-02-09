/**
 * R2 bucket reference for asset storage
 * Uses Cloudflare R2 bucket directly via bindings - no S3 SDK needed
 */

export interface R2BucketRef {
	bucket: R2Bucket;
	bucketName: string;
}

/** Maximum file size for avatars (2MB) */
export const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

/** Allowed image content types */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Validates that a content type is an allowed image type
 */
export function isValidImageType(contentType: string): boolean {
	return ALLOWED_IMAGE_TYPES.includes(contentType);
}

/**
 * Generates a key for user avatars
 */
export function generateUserAvatarKey(userId: string, extension: string): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 8);
	return `user/${userId}/avatars/${timestamp}-${random}.${extension}`;
}

/**
 * Generates a key for organization logos
 */
export function generateOrgLogoKey(organizationId: string, extension: string): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 8);
	return `organization/${organizationId}/logos/${timestamp}-${random}.${extension}`;
}

/**
 * Generates a key for team logos
 */
export function generateTeamLogoKey(
	organizationId: string,
	teamId: string,
	extension: string
): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 8);
	return `organization/${organizationId}/teams/${teamId}/logos/${timestamp}-${random}.${extension}`;
}

/**
 * Gets extension from content type
 */
export function getExtensionFromContentType(contentType: string): string {
	const map: Record<string, string> = {
		"image/jpeg": "jpg",
		"image/png": "png",
		"image/webp": "webp",
	};
	return map[contentType] || "jpg";
}

/**
 * Generates a public URL for an R2 object
 * Note: Objects must have public access configured or use a custom domain
 */
export function getPublicUrl(bucketName: string, key: string, accountId: string): string {
	// Format for Cloudflare R2 public URL (custom domain format)
	// This assumes a custom domain is configured for the bucket
	return `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${key}`;
}
