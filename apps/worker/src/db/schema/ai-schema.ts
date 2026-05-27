import { sqliteTable, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user, league } from "./auth-schema";
import { timestampAuditFields } from "./common";

export const aiProviderEnum = ["openai", "opencode"] as const;

export const aiConversation = sqliteTable(
	"ai_conversation",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		leagueId: text("league_id")
			.notNull()
			.references(() => league.id, { onDelete: "cascade" }),
		title: text("title").notNull().default("New conversation"),
		...timestampAuditFields,
	},
	(table) => [
		index("ai_conversation_user_league_idx").on(table.userId, table.leagueId, table.updatedAt),
	]
);

export const aiMessage = sqliteTable(
	"ai_message",
	{
		id: text("id").primaryKey(),
		conversationId: text("conversation_id")
			.notNull()
			.references(() => aiConversation.id, { onDelete: "cascade" }),
		role: text("role", { enum: ["user", "assistant", "tool"] }).notNull(),
		content: text("content").notNull(),
		toolName: text("tool_name"),
		toolArgs: text("tool_args"),
		toolResult: text("tool_result"),
		toolCallId: text("tool_call_id"),
		reasoningContent: text("reasoning_content"),
		...timestampAuditFields,
	},
	(table) => [index("ai_message_conversation_idx").on(table.conversationId, table.createdAt)]
);

export const aiUserSettings = sqliteTable(
	"ai_user_settings",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		provider: text("provider", { enum: aiProviderEnum }).notNull(),
		model: text("model").notNull(),
		encryptedApiKey: text("encrypted_api_key").notNull(),
		...timestampAuditFields,
	},
	(table) => [uniqueIndex("ai_user_settings_user_idx").on(table.userId)]
);
