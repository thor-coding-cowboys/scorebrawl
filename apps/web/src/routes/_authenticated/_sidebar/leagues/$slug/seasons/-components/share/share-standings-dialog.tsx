import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { trpcClient } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Link01Icon } from "@hugeicons/core-free-icons";
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
import { cn } from "@/lib/utils";

type ShareLinkExpiryPreset = "1h" | "24h" | "7d" | "30d" | "never";

const EXPIRY_OPTIONS: { value: ShareLinkExpiryPreset; label: string }[] = [
	{ value: "1h", label: "1 hour" },
	{ value: "24h", label: "24 hours" },
	{ value: "7d", label: "7 days" },
	{ value: "30d", label: "30 days" },
	{ value: "never", label: "Never" },
];

const dateFormat = new Intl.DateTimeFormat(undefined, {
	day: "numeric",
	month: "short",
	year: "numeric",
});

function expiryLabel(expiresAt: string | Date | null) {
	if (!expiresAt) return "Never expires";
	return `Expires ${dateFormat.format(new Date(expiresAt))}`;
}

interface ShareStandingsDialogProps {
	isOpen: boolean;
	onClose: () => void;
	seasonSlug: string;
}

export function ShareStandingsDialog({ isOpen, onClose, seasonSlug }: ShareStandingsDialogProps) {
	const queryClient = useQueryClient();
	const { data: activeMember } = authClient.useActiveMember();
	const isOwner = activeMember?.role === "owner";

	const [expiresIn, setExpiresIn] = useState<ShareLinkExpiryPreset>("7d");
	const [created, setCreated] = useState<{ url: string; expiresAt: Date | null } | null>(null);
	const [revokeTarget, setRevokeTarget] = useState<string | null>(null);

	const settingQuery = useQuery({
		queryKey: ["shareSetting", "get"],
		queryFn: () => trpcClient.shareSetting.get.query(),
		enabled: isOpen,
	});

	const linksQuery = useQuery({
		queryKey: ["shareLink", "list", seasonSlug],
		queryFn: () => trpcClient.shareLink.list.query({ seasonSlug }),
		enabled: isOpen,
	});

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: ["shareLink", "list", seasonSlug] });
		void queryClient.invalidateQueries({ queryKey: ["shareSetting", "get"] });
	};

	const createMutation = useMutation({
		mutationFn: () => trpcClient.shareLink.create.mutate({ seasonSlug, expiresIn }),
		onSuccess: (result) => {
			setCreated({ url: result.url, expiresAt: result.expiresAt });
			invalidate();
		},
		onError: (error) => toast.error(error.message),
	});

	const revokeMutation = useMutation({
		mutationFn: (id: string) => trpcClient.shareLink.revoke.mutate({ seasonSlug, id }),
		onSuccess: () => {
			setRevokeTarget(null);
			toast.success("Link revoked");
			invalidate();
		},
		onError: (error) => toast.error(error.message),
	});

	const settingMutation = useMutation({
		mutationFn: (allowPublicShares: boolean) =>
			trpcClient.shareSetting.update.mutate({ allowPublicShares }),
		onSuccess: (result) => {
			if (!result.allowPublicShares && result.revokedCount > 0) {
				toast.success(`Sharing disabled — ${result.revokedCount} link(s) revoked`);
			}
			setCreated(null);
			invalidate();
		},
		onError: (error) => toast.error(error.message),
	});

	const allowPublicShares = settingQuery.data?.allowPublicShares ?? false;

	async function copyLink(url: string) {
		try {
			await navigator.clipboard.writeText(url);
			toast.success("Link copied");
		} catch {
			toast.error("Couldn't copy — select and copy manually");
		}
	}

	const activeLinks = (linksQuery.data ?? []).filter((link) => !link.revokedAt);
	const inactiveLinks = (linksQuery.data ?? []).filter((link) => link.revokedAt);

	return (
		<>
			<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
				<DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden p-0">
					<DialogHeader className="border-b border-border p-6 pb-4">
						<DialogTitle className="flex items-center gap-2 text-xl font-bold">
							<HugeiconsIcon icon={Link01Icon} className="size-5" />
							Share standings
						</DialogTitle>
						<DialogDescription>
							Anyone with the link can view this season's standings — names, points and recent form.
							Revoke it at any time.
						</DialogDescription>
					</DialogHeader>

					<div className="overflow-y-auto p-6 pt-4">
						{settingQuery.isPending ? (
							<Skeleton className="h-24 w-full" />
						) : !allowPublicShares ? (
							<div className="flex flex-col gap-4 border border-border p-4">
								<div>
									<p className="text-sm font-medium">Public sharing is off for this league</p>
									<p className="mt-1 text-sm text-muted-foreground">
										{isOwner
											? "Turn it on to create links. You can turn it off again at any time — doing so revokes every active link."
											: "Ask a league owner to enable public sharing before creating a link."}
									</p>
								</div>
								{isOwner && (
									<Button
										size="sm"
										onClick={() => settingMutation.mutate(true)}
										disabled={settingMutation.isPending}
										data-testid="enable-public-sharing"
									>
										Enable sharing
									</Button>
								)}
							</div>
						) : (
							<div className="flex flex-col gap-6">
								<div className="flex flex-col gap-3">
									<p className="text-sm font-medium">Link duration</p>
									<div className="flex flex-wrap gap-2">
										{EXPIRY_OPTIONS.map((option) => (
											<Button
												key={option.value}
												type="button"
												size="sm"
												variant={expiresIn === option.value ? "default" : "outline"}
												onClick={() => setExpiresIn(option.value)}
												className={cn(expiresIn === option.value && "pointer-events-none")}
												data-testid={`share-expiry-${option.value}`}
											>
												{option.label}
											</Button>
										))}
									</div>
									{expiresIn === "never" && (
										<p className="text-xs text-muted-foreground">
											Never-expiring links stay live until you revoke them or disable sharing.
										</p>
									)}
									<div className="flex items-center gap-2">
										<Button
											size="sm"
											onClick={() => createMutation.mutate()}
											disabled={createMutation.isPending}
											data-testid="create-share-link"
										>
											{createMutation.isPending ? "Creating…" : "Create link"}
										</Button>
									</div>
								</div>

								{created && (
									<div className="flex flex-col gap-2 border border-border bg-muted/40 p-3">
										<p className="text-xs font-medium">Copy it now — it won't be shown again</p>
										<div className="flex gap-2">
											<Input readOnly value={created.url} className="font-mono text-xs" />
											<Button
												size="sm"
												variant="outline"
												onClick={() => void copyLink(created.url)}
												data-testid="copy-share-link"
											>
												<HugeiconsIcon icon={Copy01Icon} className="size-4" />
											</Button>
										</div>
										<p className="text-xs text-muted-foreground">
											{expiryLabel(created.expiresAt)}
										</p>
									</div>
								)}

								<div className="flex flex-col gap-2">
									<p className="text-sm font-medium">Links for this season</p>
									{linksQuery.isPending ? (
										<Skeleton className="h-12 w-full" />
									) : activeLinks.length === 0 && inactiveLinks.length === 0 ? (
										<p className="text-sm text-muted-foreground">No links yet.</p>
									) : (
										<ul className="flex flex-col divide-y divide-border border-y border-border">
											{[...activeLinks, ...inactiveLinks].map((link) => (
												<li
													key={link.id}
													className="flex items-center justify-between gap-3 py-2 text-sm"
												>
													<div className="min-w-0">
														<p className="truncate">
															{link.revokedAt ? "Revoked" : expiryLabel(link.expiresAt)}
														</p>
														<p className="text-xs text-muted-foreground">
															{link.createdByName ?? "Unknown"} · {link.viewCount}{" "}
															{link.viewCount === 1 ? "view" : "views"}
														</p>
													</div>
													{link.revokedAt ? (
														<Badge variant="outline">Revoked</Badge>
													) : (
														<Button
															size="sm"
															variant="ghost"
															className="text-muted-foreground hover:text-destructive"
															onClick={() => setRevokeTarget(link.id)}
														>
															Revoke
														</Button>
													)}
												</li>
											))}
										</ul>
									)}
								</div>

								{isOwner && (
									<div className="flex items-center justify-between gap-4 border-t border-border pt-4">
										<div>
											<p className="text-sm font-medium">Allow public share links</p>
											<p className="text-xs text-muted-foreground">
												Turning this off revokes every active link for this league.
											</p>
										</div>
										<Switch
											checked={allowPublicShares}
											onCheckedChange={(checked) => settingMutation.mutate(checked)}
											disabled={settingMutation.isPending}
										/>
									</div>
								)}
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={revokeTarget !== null}
				onOpenChange={(open) => !open && setRevokeTarget(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Revoke this link?</AlertDialogTitle>
						<AlertDialogDescription>
							Anyone who already has it will immediately lose access. This can't be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep link</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => revokeTarget && revokeMutation.mutate(revokeTarget)}
							disabled={revokeMutation.isPending}
						>
							Revoke
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
