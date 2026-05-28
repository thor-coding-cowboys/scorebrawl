import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface MCPConfig {
	apiBaseUrl: string;
	accessToken?: string;
}

const CONFIG_DIR = join(homedir(), ".config", "scorebrawl");
const CONFIG_FILE = join(CONFIG_DIR, "mcp.json");

const DEFAULT_CONFIG: MCPConfig = {
	apiBaseUrl: "https://scorebrawl.com",
};

function ensureConfigDir() {
	if (!existsSync(CONFIG_DIR)) {
		mkdirSync(CONFIG_DIR, { recursive: true });
	}
}

export function loadConfig(): MCPConfig {
	ensureConfigDir();
	let config = DEFAULT_CONFIG;
	if (existsSync(CONFIG_FILE)) {
		try {
			const raw = readFileSync(CONFIG_FILE, "utf-8");
			const parsed = JSON.parse(raw) as Partial<MCPConfig>;
			config = { ...DEFAULT_CONFIG, ...parsed };
		} catch {
			// ignore
		}
	}
	const envUrl = process.env.SCOREBRAWL_API_URL;
	if (envUrl) {
		config.apiBaseUrl = envUrl;
	}
	return config;
}

export function saveConfig(config: Partial<MCPConfig>): void {
	ensureConfigDir();
	const current = loadConfig();
	const merged = { ...current, ...config };
	writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
}

export function getConfigPath(): string {
	return CONFIG_FILE;
}
