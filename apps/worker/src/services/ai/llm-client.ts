import { OpenAI } from "openai";

export interface LLMMessage {
	role: "system" | "user" | "assistant" | "tool";
	content: string;
	reasoning_content?: string;
	tool_calls?: Array<{
		id: string;
		type: "function";
		function: { name: string; arguments: string };
	}>;
	name?: string;
	tool_call_id?: string;
}

export interface LLMTool {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
}

export type StreamChunk =
	| { type: "text"; content: string }
	| { type: "reasoning"; content: string }
	| { type: "tool_call"; id: string; name: string; arguments: string }
	| { type: "done"; reasoningContent?: string };

export interface LLMSettings {
	provider: "openai" | "opencode";
	model: string;
	apiKey: string;
}

export function createLLMClient(settings: LLMSettings) {
	const baseURL = settings.provider === "opencode" ? "https://opencode.ai/zen/go/v1" : undefined;
	return new LLMClient({ ...settings, baseURL });
}

function convertMessagesForProxy(messages: LLMMessage[]): LLMMessage[] {
	const converted: LLMMessage[] = [];
	for (const msg of messages) {
		if (msg.role === "assistant" && msg.tool_calls?.length) {
			const toolDesc = msg.tool_calls.map((tc) => `[Called tool: ${tc.function.name}]`).join("\n");
			converted.push({
				role: "assistant",
				content: [msg.content, toolDesc].filter(Boolean).join("\n"),
			});
		} else if (msg.role === "tool") {
			converted.push({
				role: "user",
				content: `[Tool result for ${msg.tool_call_id}]:\n${msg.content}`,
			});
		} else {
			converted.push(msg);
		}
	}
	return converted;
}

class LLMClient {
	private client: OpenAI;
	private model: string;
	private apiKey: string;
	private provider: string;

	constructor(settings: LLMSettings & { baseURL?: string }) {
		this.client = new OpenAI({ apiKey: settings.apiKey, baseURL: settings.baseURL });
		this.model = settings.model;
		this.apiKey = settings.apiKey;
		this.provider = settings.provider;
	}

	async *streamChat(messages: LLMMessage[], tools?: LLMTool[]): AsyncGenerator<StreamChunk> {
		const formattedTools = tools?.map((t) => ({
			type: "function" as const,
			function: {
				name: t.name,
				description: t.description,
				parameters: t.parameters,
			},
		}));

		const isProxy = this.provider === "opencode";
		const outMessages = isProxy ? convertMessagesForProxy(messages) : messages;

		const body: Record<string, unknown> = {
			model: this.model,
			messages: outMessages,
			stream: true,
		};
		if (formattedTools?.length) {
			body.tools = formattedTools;
		}

		const baseURL = this.client.baseURL;
		const url = `${baseURL}/chat/completions`;

		const res = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(120_000),
		});

		if (!res.ok) {
			const errorBody = await res.text();
			console.error("[LLM] Request failed", {
				status: res.status,
				url,
				model: this.model,
				messageCount: messages.length,
				messageRoles: messages.map((m) => m.role),
				hasTools: !!formattedTools?.length,
				errorBody: errorBody.slice(0, 2000),
			});
			throw new Error(`Provider error: ${res.status} ${errorBody.slice(0, 500)}`);
		}

		const pendingToolCalls = new Map<string, { id: string; name: string; args: string }>();
		let reasoningContent = "";
		const reader = res.body?.getReader();
		if (!reader) throw new Error("No response body");

		const decoder = new TextDecoder();
		let buffer = "";

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed || !trimmed.startsWith("data: ")) continue;
				const data = trimmed.slice(6);
				if (data === "[DONE]") continue;

				let chunk: {
					choices?: Array<{
						delta?: {
							content?: string;
							reasoning_content?: string;
							tool_calls?: Array<{
								index?: number;
								id?: string;
								function?: { name?: string; arguments?: string };
							}>;
						};
					}>;
				};
				try {
					chunk = JSON.parse(data);
				} catch {
					continue;
				}

				const delta = chunk.choices?.[0]?.delta;
				if (!delta) continue;

				if (delta.reasoning_content) {
					reasoningContent += delta.reasoning_content;
				}

				if (delta.tool_calls) {
					for (const tc of delta.tool_calls) {
						const key = tc.index?.toString() ?? tc.id ?? "";
						const existing = pendingToolCalls.get(key);
						if (existing) {
							existing.args += tc.function?.arguments ?? "";
						} else if (tc.id && tc.function?.name) {
							pendingToolCalls.set(key, {
								id: tc.id,
								name: tc.function.name,
								args: tc.function.arguments ?? "",
							});
						}
					}
				}

				if (delta.content) {
					yield { type: "text" as const, content: delta.content };
				}
			}
		}

		for (const tc of pendingToolCalls.values()) {
			yield { type: "tool_call" as const, id: tc.id, name: tc.name, arguments: tc.args };
		}

		yield { type: "done" as const, reasoningContent: reasoningContent || undefined };
	}
}
