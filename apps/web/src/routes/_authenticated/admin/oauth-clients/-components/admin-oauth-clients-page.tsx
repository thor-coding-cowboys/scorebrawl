import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { trpcClient } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

function formatDate(date: Date | null): string {
	if (!date) return "—";
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function formatRedirectUris(redirectUris: unknown): string {
	if (Array.isArray(redirectUris)) return (redirectUris as string[]).join(", ");
	if (typeof redirectUris === "string") {
		try {
			const parsed = JSON.parse(redirectUris);
			if (Array.isArray(parsed)) return parsed.join(", ");
		} catch {
			return redirectUris;
		}
	}
	return "—";
}

export function AdminOAuthClientsPage() {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [createdSecret, setCreatedSecret] = useState<{
		clientId: string;
		clientSecret: string | null;
	} | null>(null);

	const [name, setName] = useState("BullsAI");
	const [redirectUris, setRedirectUris] = useState("https://app.bullsai.app/callback");
	const [scopes, setScopes] = useState(
		"openid profile email offline_access create:matches read:matches"
	);
	const [publicClient, setPublicClient] = useState(true);
	const [requirePkce, setRequirePkce] = useState(true);
	const [skipConsent, setSkipConsent] = useState(false);

	const { data: clients, isPending } = useQuery({
		queryKey: ["admin", "oauthClients"],
		queryFn: async () => {
			return await trpcClient.admin.oauthClients.list.query();
		},
	});

	const createMutation = useMutation({
		mutationFn: async () => {
			return await trpcClient.admin.oauthClients.create.mutate({
				name,
				redirectUris: redirectUris
					.split("\n")
					.map((u) => u.trim())
					.filter(Boolean),
				scopes: scopes
					.split(/\s+/)
					.map((s) => s.trim())
					.filter(Boolean),
				publicClient,
				requirePkce,
				skipConsent,
			});
		},
		onSuccess: (res) => {
			setCreatedSecret({
				clientId: res.client_id,
				clientSecret: res.client_secret ?? null,
			});
			toast.success("OAuth client created");
			queryClient.invalidateQueries({ queryKey: ["admin", "oauthClients"] });
			setDialogOpen(false);
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (clientId: string) => {
			return await trpcClient.admin.oauthClients.delete.mutate({ clientId });
		},
		onSuccess: () => {
			toast.success("OAuth client deleted");
			queryClient.invalidateQueries({ queryKey: ["admin", "oauthClients"] });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">OAuth Clients</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						OAuth clients (e.g. BullsAI) can push results to the public API on behalf of linked
						users.
					</p>
				</div>
				<Button type="button" onClick={() => setDialogOpen(true)}>
					New client
				</Button>
			</div>

			{createdSecret && (
				<div className="border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
					<p className="font-semibold">Client created — save these credentials now</p>
					<p className="mt-2">
						<span className="text-muted-foreground">Client ID:</span>{" "}
						<code className="break-all">{createdSecret.clientId}</code>
					</p>
					{createdSecret.clientSecret && (
						<p className="mt-1">
							<span className="text-muted-foreground">Client Secret:</span>{" "}
							<code className="break-all">{createdSecret.clientSecret}</code>
						</p>
					)}
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="mt-3"
						onClick={() => setCreatedSecret(null)}
					>
						Dismiss
					</Button>
				</div>
			)}

			<div className="border border-border bg-card">
				<div className="flex items-center justify-between border-b border-border px-5 py-4">
					<h2 className="text-sm font-semibold">Clients</h2>
					{!isPending && (
						<span className="text-xs text-muted-foreground">{clients?.length ?? 0} total</span>
					)}
				</div>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-border">
								{["Name", "Client ID", "Redirect URIs", "Auth", "Created"].map((h) => (
									<th
										key={h}
										className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
									>
										{h}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{isPending
								? Array.from({ length: 3 }).map((_row, i) => (
										<tr key={`skeleton-${i}`} className="border-b border-border">
											{Array.from({ length: 5 }).map((_col, j) => (
												<td key={`cell-${i}-${j}`} className="px-5 py-3.5">
													<Skeleton
														className="h-4"
														style={{ width: `${[140, 200, 120, 80, 100][j]}px` }}
													/>
												</td>
											))}
										</tr>
									))
								: clients?.map((client) => (
										<tr
											key={client.clientId}
											className="border-b border-border transition hover:bg-muted/50"
										>
											<td className="px-5 py-3.5">
												<div className="font-medium">{client.name ?? "Unnamed"}</div>
												<div className="mt-1 flex items-center gap-1.5">
													{client.skipConsent ? <Badge>skip consent</Badge> : null}
													{client.disabled ? <Badge variant="destructive">disabled</Badge> : null}
												</div>
											</td>
											<td className="px-5 py-3.5">
												<code className="break-all text-xs">{client.clientId}</code>
											</td>
											<td className="px-5 py-3.5 text-xs text-muted-foreground">
												{formatRedirectUris(client.redirectUris)}
											</td>
											<td className="px-5 py-3.5 text-xs text-muted-foreground">
												{client.tokenEndpointAuthMethod ?? "—"}
											</td>
											<td className="px-5 py-3.5 text-xs text-muted-foreground">
												{formatDate(client.createdAt)}
											</td>
											<td className="px-5 py-3.5 text-right">
												<Button
													type="button"
													variant="ghost"
													size="sm"
													className="text-rose-500 hover:text-rose-400"
													onClick={() => deleteMutation.mutate(client.clientId)}
												>
													Delete
												</Button>
											</td>
										</tr>
									))}
						</tbody>
					</table>
				</div>
			</div>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create OAuth client</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="name">Name</FieldLabel>
								<Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor="redirectUris">Redirect URIs (one per line)</FieldLabel>
								<textarea
									id="redirectUris"
									className="min-h-20 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
									value={redirectUris}
									onChange={(e) => setRedirectUris(e.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="scopes">Scopes (space-separated)</FieldLabel>
								<Input id="scopes" value={scopes} onChange={(e) => setScopes(e.target.value)} />
							</Field>
							<Field>
								<FieldLabel>Public client (PKCE)</FieldLabel>
								<Switch checked={publicClient} onCheckedChange={setPublicClient} />
							</Field>
							<Field>
								<FieldLabel>Require PKCE</FieldLabel>
								<Switch checked={requirePkce} onCheckedChange={setRequirePkce} />
							</Field>
							<Field>
								<FieldLabel>Skip consent screen</FieldLabel>
								<Switch checked={skipConsent} onCheckedChange={setSkipConsent} />
							</Field>
						</FieldGroup>
						<div className="flex justify-end gap-2">
							<Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
								Cancel
							</Button>
							<Button
								type="button"
								disabled={createMutation.isPending}
								onClick={() => createMutation.mutate()}
							>
								Create
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
