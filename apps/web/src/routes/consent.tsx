import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { fetchSessionForRoute } from "@/hooks/useSession";

const scopeLabels: Record<string, string> = {
	openid: "Sign in with your Scorebrawl account",
	profile: "Read your profile information",
	email: "Read your email address",
	offline_access: "Keep access when you're offline",
	"create:matches": "Record match results in your leagues",
	"read:matches": "Read match results from your leagues",
};

export const Route = createFileRoute("/consent")({
	component: RouteComponent,
	beforeLoad: async ({ context }) => {
		const session = await fetchSessionForRoute(context.queryClient);
		if (!session?.session) {
			const current = new URL(window.location.href);
			throw redirect({
				to: "/auth/sign-in",
				search: { redirect: current.pathname + current.search },
			});
		}
		return { session };
	},
});

function RouteComponent() {
	const [submitting, setSubmitting] = useState<"accept" | "deny" | null>(null);
	const [error, setError] = useState<string | null>(null);

	const params = new URLSearchParams(window.location.search);
	const clientId = params.get("client_id") ?? "";
	const scopes = (params.get("scope") ?? "").split(" ").filter(Boolean);

	const submit = async (accept: boolean) => {
		setSubmitting(accept ? "accept" : "deny");
		setError(null);
		try {
			const res = await authClient.oauth2.consent({ accept });
			if (res.error) {
				setError(res.error.message || "Consent failed");
				setSubmitting(null);
			}
		} catch {
			setError("Consent failed");
			setSubmitting(null);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Connect to Scorebrawl</CardTitle>
					<CardDescription>
						Allow <span className="font-medium">{clientId}</span> to access your Scorebrawl account.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ul className="space-y-2 text-sm">
						{scopes.map((scope) => (
							<li key={scope} className="flex items-start gap-2">
								<span aria-hidden>•</span>
								<span>{scopeLabels[scope] ?? scope}</span>
							</li>
						))}
					</ul>
					{error && <p className="mt-4 text-sm text-rose-500">{error}</p>}
					<div className="mt-6 flex justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							disabled={submitting !== null}
							onClick={() => submit(false)}
						>
							Deny
						</Button>
						<Button type="button" disabled={submitting !== null} onClick={() => submit(true)}>
							{submitting === "accept" ? "Connecting…" : "Allow"}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
