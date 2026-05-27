import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { trpcClient } from "@/lib/trpc";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Settings01Icon } from "@hugeicons/core-free-icons";
import { ConversationSidebar } from "./conversation-sidebar";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";
import { SettingsModal } from "./settings-modal";

interface ChatLayoutProps {
	leagueSlug: string;
}

export interface ChartData {
	type: "bar" | "line" | "pie";
	title: string;
	data: Array<Record<string, unknown>>;
	xKey?: string;
	yKeys?: string[];
}

export function ChatLayout({ leagueSlug }: ChatLayoutProps) {
	const queryClient = useQueryClient();
	const [activeConversationId, setActiveConversationId] = useState<string | undefined>();
	const [streamingContent, setStreamingContent] = useState("");
	const [isStreaming, setIsStreaming] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
	const [toolCallInProgress, setToolCallInProgress] = useState<string | null>(null);
	const [streamingCharts, setStreamingCharts] = useState<ChartData[]>([]);
	const eventSourceRef = useRef<EventSource | null>(null);

	const { data: conversationData } = useQuery({
		queryKey: ["ai-conversation", activeConversationId],
		queryFn: () => trpcClient.ai.getConversation.query({ conversationId: activeConversationId! }),
		enabled: !!activeConversationId,
	});

	const createMessage = useMutation({
		mutationFn: (input: { conversationId?: string; content: string }) =>
			trpcClient.ai.createMessage.mutate(input),
	});

	const closeEventSource = useCallback(() => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}
	}, []);

	useEffect(() => {
		return () => {
			closeEventSource();
		};
	}, [closeEventSource]);

	const startStream = useCallback(
		(conversationId: string) => {
			closeEventSource();
			setStreamingContent("");
			setIsStreaming(true);
			setToolCallInProgress("thinking");
			setStreamingCharts([]);

			const url = new URL("/api/ai/chat-stream", window.location.origin);
			url.searchParams.set("conversationId", conversationId);

			const es = new EventSource(url.toString());
			eventSourceRef.current = es;

			es.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data) as {
						type: string;
						content?: string;
						toolName?: string;
						toolArgs?: string;
						error?: string;
						chart?: ChartData;
					};

					if (data.type === "text" && data.content) {
						setToolCallInProgress(null);
						setStreamingContent((prev) => prev + data.content);
					} else if (data.type === "tool_call" && data.toolName) {
						setToolCallInProgress(data.toolName);
					} else if (data.type === "tool_result") {
						setToolCallInProgress("analyzing");
					} else if (data.type === "chart" && data.chart) {
						setToolCallInProgress(null);
						setStreamingCharts((prev) => [...prev, data.chart!]);
					} else if (data.type === "done") {
						setIsStreaming(false);
						setStreamingContent("");
						setPendingUserMessage(null);
						setToolCallInProgress(null);
						setStreamingCharts([]);
						queryClient.invalidateQueries({ queryKey: ["ai-conversation", conversationId] });
						queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
						es.close();
					} else if (data.type === "error") {
						setIsStreaming(false);
						setToolCallInProgress(null);
						toast.error(data.error || "Stream error");
						es.close();
					}
				} catch {
					// Ignore malformed events
				}
			};

			es.onerror = () => {
				setIsStreaming((wasStreaming) => {
					if (wasStreaming) {
						toast.error("Connection to AI lost. Try again.");
					}
					return false;
				});
				setToolCallInProgress(null);
				setPendingUserMessage(null);
				queryClient.invalidateQueries({ queryKey: ["ai-conversation", conversationId] });
				queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
				es.close();
			};
		},
		[closeEventSource, queryClient]
	);

	const handleSend = useCallback(
		async (content: string) => {
			if (!content.trim()) return;
			setPendingUserMessage(content.trim());

			try {
				const result = await createMessage.mutateAsync({
					conversationId: activeConversationId,
					content,
				});

				const newConversationId = result.conversationId;
				if (newConversationId !== activeConversationId) {
					setActiveConversationId(newConversationId);
					queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
				}

				await queryClient.invalidateQueries({ queryKey: ["ai-conversation", newConversationId] });
				startStream(newConversationId);
			} catch (err) {
				setPendingUserMessage(null);
				toast.error(err instanceof Error ? err.message : "Failed to send message");
			}
		},
		[activeConversationId, createMessage, queryClient, startStream]
	);

	const handleCreateConversation = useCallback(() => {
		setActiveConversationId(undefined);
		setStreamingContent("");
		setPendingUserMessage(null);
		setToolCallInProgress(null);
		setStreamingCharts([]);
		closeEventSource();
	}, [closeEventSource]);

	const messages = conversationData?.messages ?? [];

	return (
		<div className="flex h-full">
			<ConversationSidebar
				leagueSlug={leagueSlug}
				activeConversationId={activeConversationId}
				onSelectConversation={setActiveConversationId}
				onCreateConversation={handleCreateConversation}
			/>
			<div className="flex flex-1 flex-col">
				<div className="flex items-center justify-between border-b px-4 py-2">
					<h2 className="text-sm font-medium">{conversationData?.title ?? "New Conversation"}</h2>
					<Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
						<HugeiconsIcon icon={Settings01Icon} className="size-4" />
					</Button>
				</div>
				<MessageList
					messages={messages}
					streamingContent={streamingContent}
					pendingUserMessage={pendingUserMessage}
					toolCallInProgress={toolCallInProgress}
					streamingCharts={streamingCharts}
				/>
				<MessageInput onSend={handleSend} disabled={isStreaming} />
			</div>
			<SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
		</div>
	);
}
