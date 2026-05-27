import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { loadConfig } from "./config.js";

interface Agent {
	name: string;
	dir: string;
	configFile: string;
}

const AGENTS: Agent[] = [
	{ name: "claude", dir: ".claude", configFile: "mcp.json" },
	{ name: "opencode", dir: ".opencode", configFile: "settings.local.json" },
];

function detectAgents(): Agent[] {
	return AGENTS.filter((a) => existsSync(join(homedir(), a.dir)));
}

function getAgentConfigPath(agent: Agent): string {
	return join(homedir(), agent.dir, agent.configFile);
}

function readJson(path: string): Record<string, unknown> {
	if (!existsSync(path)) return {};
	try {
		return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
	} catch {
		return {};
	}
}

function writeJson(path: string, data: Record<string, unknown>): void {
	writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

function getMcpEntry(useLocal: boolean): Record<string, unknown> {
	const baseUrl = loadConfig().apiBaseUrl;

	if (useLocal) {
		// Use local build path for development
		const localPath = join(process.cwd(), "dist", "index.js");
		return {
			command: "node",
			args: [localPath],
			env: {
				SCOREBRAWL_API_URL: baseUrl,
			},
		};
	}

	return {
		command: "npx",
		args: ["-y", "@scorebrawl/mcp"],
		env: {
			SCOREBRAWL_API_URL: baseUrl,
		},
	};
}

function installToOpenCode(useLocal: boolean): void {
	const path = getAgentConfigPath({
		name: "opencode",
		dir: ".opencode",
		configFile: "settings.local.json",
	});
	const config = readJson(path);
	const mcpServers = (config.mcpServers as Record<string, unknown>) || {};

	mcpServers.scorebrawl = getMcpEntry(useLocal);
	config.mcpServers = mcpServers;

	writeJson(path, config);
	console.log(`Added scorebrawl MCP server to OpenCode config: ${path}`);
}

function installToClaude(useLocal: boolean): void {
	const baseUrl = loadConfig().apiBaseUrl;
	const envFlag = `-e SCOREBRAWL_API_URL=${baseUrl}`;

	if (useLocal) {
		const localPath = join(process.cwd(), "dist", "index.js");
		const cmd = `claude mcp add scorebrawl ${envFlag} -- node ${localPath}`;
		console.log(`Running: ${cmd}`);
		execSync(cmd, { stdio: "inherit" });
	} else {
		const cmd = `claude mcp add scorebrawl ${envFlag} -- npx -y @scorebrawl/mcp`;
		console.log(`Running: ${cmd}`);
		execSync(cmd, { stdio: "inherit" });
	}
}

export async function runInstall(agentName?: string, useLocal = false): Promise<void> {
	const detected = detectAgents();

	if (detected.length === 0) {
		console.error("No supported agent harnesses detected (Claude Code, OpenCode).");
		console.error("Install one of them first, or add the MCP server manually.");
		process.exit(1);
	}

	let target: Agent | undefined;

	if (agentName) {
		target = AGENTS.find((a) => a.name === agentName);
		if (!target) {
			console.error(`Unknown agent: ${agentName}`);
			console.error(`Supported: ${AGENTS.map((a) => a.name).join(", ")}`);
			process.exit(1);
		}
		// Verify the agent is actually installed
		if (!detected.some((d) => d.name === target!.name)) {
			console.error(`${target.name} is not installed (no ~/${target.dir} directory found).`);
			process.exit(1);
		}
	} else if (detected.length === 1) {
		target = detected[0];
		console.log(`Detected ${target.name}. Installing...`);
	} else {
		console.error("Multiple agents detected. Please specify one:");
		for (const a of detected) {
			console.error(`  npx @scorebrawl/mcp install ${a.name}`);
		}
		process.exit(1);
	}

	if (target.name === "opencode") {
		installToOpenCode(useLocal);
	} else if (target.name === "claude") {
		installToClaude(useLocal);
	}

	console.log("\nDone! Restart your agent for the MCP server to be available.");
}
