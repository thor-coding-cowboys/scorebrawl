import { createFileRoute } from "@tanstack/react-router";
import { ChatLayout } from "./-components/chat-layout";

export const Route = createFileRoute("/_authenticated/_sidebar/leagues/$slug/ai-chat/")({
	component: AIChatPage,
});

function AIChatPage() {
	const { slug } = Route.useParams();
	return <ChatLayout leagueSlug={slug} />;
}
