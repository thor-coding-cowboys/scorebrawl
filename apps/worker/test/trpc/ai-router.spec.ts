import { beforeEach, describe, expect, it } from "vitest";
import { createAuthContext } from "../setup/auth-context-util";
import { createTRPCTestClient } from "./trpc-test-client";

describe("ai router", () => {
	let sessionToken: string;

	beforeEach(async () => {
		const ctx = await createAuthContext();
		sessionToken = ctx.sessionToken;
	});

	it("creates a message and conversation", async () => {
		const client = createTRPCTestClient({ sessionToken });

		const result = await client.ai.createMessage.mutate({
			content: "Hello, what are the player stats?",
		});

		expect(result.conversationId).toBeDefined();
		expect(typeof result.conversationId).toBe("string");
	});

	it("lists conversations", async () => {
		const client = createTRPCTestClient({ sessionToken });

		await client.ai.createMessage.mutate({
			content: "Test conversation",
		});

		const list = await client.ai.listConversations.query();
		expect(list.conversations).toBeInstanceOf(Array);
		expect(list.conversations.length).toBeGreaterThanOrEqual(1);
	});

	it("gets a conversation with messages", async () => {
		const client = createTRPCTestClient({ sessionToken });

		const { conversationId } = await client.ai.createMessage.mutate({
			content: "What is the weather?",
		});

		const conv = await client.ai.getConversation.query({ conversationId });
		expect(conv).not.toBeNull();
		expect(conv?.id).toBe(conversationId);
		expect(conv?.messages).toBeInstanceOf(Array);
		expect(conv?.messages.length).toBe(1);
		expect(conv?.messages[0].role).toBe("user");
	});

	it("deletes a conversation", async () => {
		const client = createTRPCTestClient({ sessionToken });

		const { conversationId } = await client.ai.createMessage.mutate({
			content: "Delete me",
		});

		await client.ai.deleteConversation.mutate({ conversationId });

		const conv = await client.ai.getConversation.query({ conversationId });
		expect(conv).toBeNull();
	});

	it("updates and gets settings", async () => {
		const client = createTRPCTestClient({ sessionToken });

		await client.ai.updateSettings.mutate({
			provider: "openai",
			model: "gpt-4o",
			apiKey: "sk-test-key",
		});

		const settings = await client.ai.getSettings.query();
		expect(settings).not.toBeNull();
		expect(settings?.provider).toBe("openai");
		expect(settings?.model).toBe("gpt-4o");
		expect(settings?.apiKey).toBe("sk-test-key");
	});

	it("returns unauthorized without session", async () => {
		const client = createTRPCTestClient();

		await expect(client.ai.listConversations.query()).rejects.toThrow();
	});
});
