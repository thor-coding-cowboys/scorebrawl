import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { trpcClient } from "@/lib/trpc";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete01Icon, MessageAdd01Icon } from "@hugeicons/core-free-icons";

interface ConversationSidebarProps {
	leagueSlug: string;
	activeConversationId?: string;
	onSelectConversation: (id: string) => void;
	onCreateConversation: () => void;
}

export function ConversationSidebar({
	activeConversationId,
	onSelectConversation,
	onCreateConversation,
}: ConversationSidebarProps) {
	const queryClient = useQueryClient();
	const { data } = useQuery({
		queryKey: ["ai-conversations"],
		queryFn: () => trpcClient.ai.listConversations.query(),
	});

	const deleteConversation = useMutation({
		mutationFn: (conversationId: string) =>
			trpcClient.ai.deleteConversation.mutate({ conversationId }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
			toast.success("Conversation deleted");
		},
	});

	const conversations = data?.conversations ?? [];

	return (
		<div className="flex h-full w-64 flex-col border-r bg-muted/30">
			<div className="flex items-center justify-between p-3 border-b">
				<h3 className="text-sm font-medium">Conversations</h3>
				<Button variant="ghost" size="sm" onClick={onCreateConversation}>
					<HugeiconsIcon icon={MessageAdd01Icon} className="size-4" />
				</Button>
			</div>
			<div className="flex-1 overflow-auto p-2 space-y-1">
				{conversations.length === 0 ? (
					<p className="text-xs text-muted-foreground text-center py-4">No conversations yet</p>
				) : (
					conversations.map((conv) => (
						<div
							key={conv.id}
							className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer ${
								conv.id === activeConversationId ? "bg-primary/10 text-primary" : "hover:bg-muted"
							}`}
							onClick={() => onSelectConversation(conv.id)}
						>
							<span className="truncate flex-1">{conv.title}</span>
							<Button
								variant="ghost"
								size="sm"
								className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
								onClick={(e) => {
									e.stopPropagation();
									deleteConversation.mutate(conv.id);
								}}
							>
								<HugeiconsIcon icon={Delete01Icon} className="size-3" />
							</Button>
						</div>
					))
				)}
			</div>
		</div>
	);
}
