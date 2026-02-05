/**
 * Extracts JSON from potentially mixed LLM output.
 *
 * OpenCode/Kimi 2.5 doesn't have strict JSON schema enforcement like Claude Code's
 * --json-schema flag, so output may contain markdown, explanations, or other text
 * mixed with the JSON. This utility handles various output formats.
 */

/**
 * Attempts to extract and parse JSON from a string that may contain
 * additional text around the JSON object.
 *
 * @param output - Raw output from the LLM which may contain JSON
 * @returns Parsed JSON object of type T
 * @throws Error if no valid JSON can be extracted
 */
export function extractJson<T>(output: string): T {
	const trimmed = output.trim();

	// Try direct parse first (cleanest case)
	try {
		return JSON.parse(trimmed);
	} catch {
		// Continue to other strategies
	}

	// Try to find JSON in code blocks (```json ... ``` or ``` ... ```)
	const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (codeBlockMatch) {
		try {
			return JSON.parse(codeBlockMatch[1].trim());
		} catch {
			// Continue to other strategies
		}
	}

	// Try to find a JSON object in the output
	const jsonObjectMatch = trimmed.match(/\{[\s\S]*\}/);
	if (jsonObjectMatch) {
		try {
			return JSON.parse(jsonObjectMatch[0]);
		} catch {
			// Continue to other strategies
		}
	}

	// Try to find a JSON array in the output
	const jsonArrayMatch = trimmed.match(/\[[\s\S]*\]/);
	if (jsonArrayMatch) {
		try {
			return JSON.parse(jsonArrayMatch[0]);
		} catch {
			// Failed
		}
	}

	throw new Error(
		`No valid JSON found in output. Raw output:\n${trimmed.slice(0, 500)}...`,
	);
}

/**
 * Safely extracts JSON, returning a default value if extraction fails.
 *
 * @param output - Raw output from the LLM
 * @param defaultValue - Value to return if extraction fails
 * @returns Parsed JSON or the default value
 */
export function extractJsonSafe<T>(output: string, defaultValue: T): T {
	try {
		return extractJson<T>(output);
	} catch {
		return defaultValue;
	}
}

/**
 * Reads a file and extracts JSON from its contents.
 *
 * @param filePath - Path to the file containing LLM output
 * @returns Parsed JSON object of type T
 */
export async function extractJsonFromFile<T>(filePath: string): Promise<T> {
	const content = await Bun.file(filePath).text();
	return extractJson<T>(content);
}
