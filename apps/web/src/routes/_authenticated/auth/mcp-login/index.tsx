import { useSearch } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const mcpLoginSearchSchema = z.object({
	callback: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/auth/mcp-login/")({
	component: McpLoginPage,
	validateSearch: zodValidator(mcpLoginSearchSchema),
});

function McpLoginPage() {
	const { callback } = useSearch({ from: "/_authenticated/auth/mcp-login/" });
	const [copied, setCopied] = useState(false);
	const [isAuthorizing, setIsAuthorizing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleConnect = async () => {
		if (!callback) return;
		setIsAuthorizing(true);
		setError(null);
		try {
			const res = await fetch("/api/mcp-auth/authorize", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			});
			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || `Authorize failed: ${res.status}`);
			}
			const { code } = (await res.json()) as { code: string };
			const url = new URL(callback);
			url.searchParams.set("code", code);
			window.location.href = url.toString();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Authorization failed.");
			setIsAuthorizing(false);
		}
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
						This will authorize your local MCP server to access your active league.
					</p>
					{callback ? (
						<>
							<Button onClick={handleConnect} className="w-full" disabled={isAuthorizing}>
								{isAuthorizing ? "Authorizing…" : "Authorize MCP Server"}
							</Button>
							{error ? <p className="text-sm text-destructive">{error}</p> : null}
						</>
					) : (
						<div className="space-y-2">
							<p className="text-sm text-muted-foreground">Run this command in your terminal:</p>
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
