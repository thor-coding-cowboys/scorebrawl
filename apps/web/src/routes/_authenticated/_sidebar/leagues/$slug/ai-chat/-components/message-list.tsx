import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChartData } from "./chat-layout";
import { ChartRenderer } from "./chart-renderer";

interface Message {
	id: string;
	role: "user" | "assistant" | "tool";
	content: string;
	toolName?: string | null;
	toolArgs?: string | null;
}

interface MessageListProps {
	messages: Message[];
	streamingContent?: string;
	pendingUserMessage?: string | null;
	toolCallInProgress?: string | null;
	streamingCharts?: ChartData[];
}

export function MessageList({
	messages,
	streamingContent,
	pendingUserMessage,
	toolCallInProgress,
	streamingCharts,
}: MessageListProps) {
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, streamingContent, pendingUserMessage, toolCallInProgress, streamingCharts]);

	const showPending =
		pendingUserMessage &&
		!messages.some((m) => m.role === "user" && m.content === pendingUserMessage);

	const visibleMessages = messages.filter(
		(m) => m.role !== "tool" && !(m.role === "assistant" && m.toolArgs) && m.content.trim() !== ""
	);

	const persistedCharts: ChartData[] = messages
		.filter((m) => m.role === "tool" && m.toolName === "render_chart" && m.toolArgs)
		.map((m) => {
			try {
				return JSON.parse(m.toolArgs!) as ChartData;
			} catch {
				return null;
			}
		})
		.filter((c): c is ChartData => c !== null);

	return (
		<div className="flex-1 overflow-auto p-4 space-y-4">
			{visibleMessages.map((msg) => (
				<div
					key={msg.id}
					className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
				>
					<div
						className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
							msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
						}`}
					>
						{msg.role === "assistant" ? (
							<div className="prose prose-sm dark:prose-invert max-w-none">
								<ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
							</div>
						) : (
							<div className="whitespace-pre-wrap">{msg.content}</div>
						)}
					</div>
				</div>
			))}
			{persistedCharts.map((chart, i) => (
				<ChartRenderer key={`persisted-${i}`} chart={chart} />
			))}
			{showPending && (
				<div className="flex justify-end">
					<div className="max-w-[80%] rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">
						<div className="whitespace-pre-wrap">{pendingUserMessage}</div>
					</div>
				</div>
			)}
			{streamingContent && (
				<div className="flex justify-start">
					<div className="max-w-[80%] rounded-lg bg-muted px-4 py-2 text-sm">
						<div className="prose prose-sm dark:prose-invert max-w-none">
							<ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
						</div>
					</div>
				</div>
			)}
			{streamingCharts?.map((chart, i) => (
				<ChartRenderer key={i} chart={chart} />
			))}
			{toolCallInProgress && (
				<div className="flex justify-start">
					<div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-xs text-muted-foreground">
						<span className="inline-block size-1.5 animate-pulse rounded-full bg-current" />
						{toolCallInProgress === "analyzing"
							? "Analyzing results…"
							: toolCallInProgress === "thinking"
								? "Thinking…"
								: `Looking up ${toolCallInProgress.replace(/_/g, " ")}…`}
					</div>
				</div>
			)}
			<div ref={bottomRef} />
		</div>
	);
}
