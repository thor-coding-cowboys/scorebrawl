import { useSearch } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/auth/mcp-login/")({
	component: McpLoginPage,
});

function McpLoginPage() {
	const { callback } = useSearch({ from: "/_authenticated/auth/mcp-login/" });
	const [copied, setCopied] = useState(false);

	const handleConnect = () => {
		if (!callback) return;
		window.location.href = `${callback}?status=success`;
	};

	const handleCopyCommand = () => {
		const command = "npx @scorebrawl/mcp login";
		navigator.clipboard.writeText(command);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Connect MCP Server</CardTitle>
					<CardDescription>
						Connect your local AI agent to your Scorebrawl database.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm text-muted-foreground">
						This will authorize your local MCP server to access your league data.
					</p>
					{callback ? (
						<Button onClick={handleConnect} className="w-full">
							Authorize MCP Server
						</Button>
					) : (
						<div className="space-y-2">
							<p className="text-sm text-muted-foreground">
								Run this command in your terminal:
							</p>
							<code className="block rounded bg-muted px-3 py-2 text-sm font-mono">
								npx @scorebrawl/mcp login
							</code>
							<Button onClick={handleCopyCommand} variant="outline" className="w-full">
								{copied ? "Copied!" : "Copy Command"}
							</Button>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
