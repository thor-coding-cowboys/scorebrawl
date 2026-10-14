import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { trpcClient } from "@/lib/trpc";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { truncateSlug } from "@coding-cowboys/scorebrawl-core/presentation";

const SCOPE_OPTIONS = [
	"session:start",
	"session:stop",
	"match:start",
	"match:log",
	"match:score",
	"match:cancel",
	"match:lineup",
] as const;
type Scope = (typeof SCOPE_OPTIONS)[number];

const EXPIRY_OPTIONS = [
	{ value: "30d", label: "30 days" },
	{ value: "90d", label: "90 days" },
	{ value: "1y", label: "1 year" },
	{ value: "never", label: "Never" },
] as const;
type Expiry = (typeof EXPIRY_OPTIONS)[number]["value"];

type ApiKey = Awaited<ReturnType<typeof trpcClient.apiKey.list.query>>[number];

function isScope(value: string): value is Scope {
	return (SCOPE_OPTIONS as readonly string[]).includes(value);
}

function isExpiry(value: string): value is Expiry {
	return (EXPIRY_OPTIONS as readonly { value: string }[]).some((option) => option.value === value);
}

function formatDate(value: Date | string | null | undefined): string {
	if (!value) return "Never";
	return new Date(value).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function ApiKeysPage({ slug }: { slug: string }) {
	const queryClient = useQueryClient();

	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [name, setName] = useState("");
	const [scopes, setScopes] = useState<Set<Scope>>(new Set());
	const [expiry, setExpiry] = useState<Expiry>("90d");

	const [revealed, setRevealed] = useState<{ name: string; key: string } | null>(null);
	const [copied, setCopied] = useState(false);

	const [regenerateTarget, setRegenerateTarget] = useState<ApiKey | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null);

	const invalidateList = () => queryClient.invalidateQueries({ queryKey: ["apiKey", "list"] });

	const { data: keys, isPending } = useQuery({
		queryKey: ["apiKey", "list"],
		queryFn: () => trpcClient.apiKey.list.query(),
	});

	const createMutation = useMutation({
		mutationFn: () => trpcClient.apiKey.create.mutate({ name, scopes: [...scopes], expiry }),
		onSuccess: (res) => {
			setRevealed({ name: res.name, key: res.key });
			setIsCreateOpen(false);
			setName("");
			setScopes(new Set());
			setExpiry("90d");
			void invalidateList();
		},
		onError: (error) => toast.error(error.message),
	});

	const regenerateMutation = useMutation({
		mutationFn: (target: ApiKey) => {
			const validScopes = target.scopes.filter(isScope);
			if (validScopes.length === 0) {
				throw new Error("This key has no valid scopes and cannot be regenerated");
			}
			return trpcClient.apiKey.regenerate.mutate({
				id: target.id,
				name: target.name || "API Key",
				scopes: validScopes,
				expiry: isExpiry(target.expiry) ? target.expiry : "never",
			});
		},
		onSuccess: (res) => {
			setRevealed({ name: res.name, key: res.key });
			void invalidateList();
		},
		onError: (error) => toast.error(error.message),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.apiKey.delete.mutate({ id }),
		onSuccess: () => {
			toast.success("API key deleted");
			void invalidateList();
		},
		onError: (error) => toast.error(error.message),
	});

	const toggleScope = (scope: Scope) => {
		setScopes((prev) => {
			const next = new Set(prev);
			if (next.has(scope)) {
				next.delete(scope);
			} else {
				next.add(scope);
			}
			return next;
		});
	};

	const copyKey = async () => {
		if (!revealed) return;
		await navigator.clipboard.writeText(revealed.key);
		setCopied(true);
		toast.success("API key copied");
		setTimeout(() => setCopied(false), 2000);
	};

	const canSubmit = name.trim().length > 0 && scopes.size > 0 && !createMutation.isPending;

	return (
		<>
			<Header
				breadcrumbs={[
					{ name: "League", href: "/leagues" },
					{ name: truncateSlug(slug), href: `/leagues/${slug}` },
					{ name: "API Keys" },
				]}
				rightContent={
					<Button type="button" onClick={() => setIsCreateOpen(true)}>
						New API Key
					</Button>
				}
			/>
			<div className="flex flex-1 flex-col gap-4 p-4 pt-0">
				<div className="bg-muted/50 flex-1 p-6">
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-medium">API Keys</h3>
							{!isPending && (
								<span className="text-sm text-muted-foreground">{keys?.length ?? 0} total</span>
							)}
						</div>
						<div className="border border-border bg-card">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Key</TableHead>
										<TableHead>Scopes</TableHead>
										<TableHead>Expires</TableHead>
										<TableHead>Created</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{isPending ? (
										Array.from({ length: 3 }).map((_row, i) => (
											<TableRow key={`skeleton-${i}`}>
												{Array.from({ length: 6 }).map((_col, j) => (
													<TableCell key={`cell-${i}-${j}`}>
														<Skeleton className="h-4 w-24" />
													</TableCell>
												))}
											</TableRow>
										))
									) : keys && keys.length > 0 ? (
										keys.map((key) => (
											<TableRow key={key.id}>
												<TableCell className="font-medium">{key.name || "Unnamed"}</TableCell>
												<TableCell>
													<code className="font-mono text-xs">{key.start}…</code>
												</TableCell>
												<TableCell>
													<div className="flex flex-wrap gap-1">
														{key.scopes.length > 0 ? (
															key.scopes.map((scope) => (
																<Badge key={scope} variant="secondary">
																	{scope}
																</Badge>
															))
														) : (
															<span className="text-muted-foreground">—</span>
														)}
													</div>
												</TableCell>
												<TableCell className="text-muted-foreground">
													{formatDate(key.expiresAt)}
												</TableCell>
												<TableCell className="text-muted-foreground">
													{formatDate(key.createdAt)}
												</TableCell>
												<TableCell>
													<div className="flex items-center justify-end gap-1">
														<Button
															type="button"
															variant="ghost"
															size="sm"
															disabled={key.scopes.filter(isScope).length === 0}
															onClick={() => setRegenerateTarget(key)}
														>
															Regenerate
														</Button>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															className="text-rose-500 hover:text-rose-400"
															onClick={() => setDeleteTarget(key)}
														>
															Delete
														</Button>
													</div>
												</TableCell>
											</TableRow>
										))
									) : (
										<TableRow>
											<TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
												No API keys yet
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</div>
					</div>
				</div>
			</div>

			<Dialog
				open={isCreateOpen}
				onOpenChange={(open) => {
					setIsCreateOpen(open);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create API key</DialogTitle>
						<DialogDescription>
							Grant programmatic access to this league. The key is shown once after creation.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="api-key-name">Name</FieldLabel>
								<Input
									id="api-key-name"
									placeholder="Scoring tablet"
									value={name}
									onChange={(e) => setName(e.target.value)}
								/>
							</Field>
							<Field>
								<FieldLabel>Scopes</FieldLabel>
								<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
									{SCOPE_OPTIONS.map((scope) => (
										<label key={scope} className="flex cursor-pointer items-center gap-2 text-sm">
											<Checkbox
												checked={scopes.has(scope)}
												onCheckedChange={() => toggleScope(scope)}
											/>
											<code>{scope}</code>
										</label>
									))}
								</div>
							</Field>
							<Field>
								<FieldLabel>Expiry</FieldLabel>
								<Select
									value={expiry}
									onValueChange={(value: string | null) => {
										if (value) setExpiry(value as Expiry);
									}}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{EXPIRY_OPTIONS.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
						</FieldGroup>
						<div className="flex justify-end gap-2">
							<Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
								Cancel
							</Button>
							<Button type="button" disabled={!canSubmit} onClick={() => createMutation.mutate()}>
								{createMutation.isPending ? "Creating..." : "Create"}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={revealed !== null} onOpenChange={(open) => !open && setRevealed(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>API key created</DialogTitle>
						<DialogDescription>
							This key won't be shown again. Copy it now and store it somewhere safe.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div className="break-all border border-emerald-500/40 bg-emerald-500/5 p-3">
							<code className="font-mono text-xs break-all">{revealed?.key}</code>
						</div>
						<div className="flex justify-end gap-2">
							<Button type="button" variant="outline" onClick={() => setRevealed(null)}>
								Dismiss
							</Button>
							<Button type="button" onClick={copyKey}>
								{copied ? "Copied" : "Copy"}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={regenerateTarget !== null}
				onOpenChange={(open) => !open && setRegenerateTarget(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Regenerate API key?</AlertDialogTitle>
						<AlertDialogDescription>
							The current key "{regenerateTarget?.name || "Unnamed"}" stops working immediately. A
							new key is shown once.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={regenerateMutation.isPending}
							onClick={() => {
								if (regenerateTarget) {
									regenerateMutation.mutate(regenerateTarget);
								}
								setRegenerateTarget(null);
							}}
						>
							{regenerateMutation.isPending ? "Regenerating..." : "Regenerate"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => !open && setDeleteTarget(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete API key?</AlertDialogTitle>
						<AlertDialogDescription>
							The key "{deleteTarget?.name || "Unnamed"}" is permanently revoked and cannot be
							recovered.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={deleteMutation.isPending}
							onClick={() => {
								if (deleteTarget) {
									deleteMutation.mutate(deleteTarget.id);
								}
								setDeleteTarget(null);
							}}
						>
							{deleteMutation.isPending ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
