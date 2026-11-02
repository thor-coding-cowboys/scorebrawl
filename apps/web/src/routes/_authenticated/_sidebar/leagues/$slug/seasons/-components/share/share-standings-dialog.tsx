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
import {
	CheckmarkCircle02Icon,
	Copy01Icon,
	Link01Icon,
	LockIcon,
	Share01Icon,
} from "@hugeicons/core-free-icons";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
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

const EXPIRY_OPTIONS: { value: ShareLinkExpiryPreset; short: string; unit: string }[] = [
	{ value: "1h", short: "1", unit: "hour" },
	{ value: "24h", short: "24", unit: "hours" },
	{ value: "7d", short: "7", unit: "days" },
	{ value: "30d", short: "30", unit: "days" },
	{ value: "never", short: "∞", unit: "never" },
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

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
			{children}
		</span>
	);
}

interface ShareStandingsDialogProps {
	isOpen: boolean;
	onClose: () => void;
	seasonSlug: string;
	isClosedSeason?: boolean;
}

export function ShareStandingsDialog({
	isOpen,
	onClose,
	seasonSlug,
	isClosedSeason = false,
}: ShareStandingsDialogProps) {
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
				<DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-xl">
					<DialogHeader className="relative isolate gap-3 overflow-hidden border-b border-foreground/10 p-6 pb-5">
						<div
							aria-hidden="true"
							className={cn(
								"pointer-events-none absolute inset-0 -z-10",
								isClosedSeason
									? "bg-[radial-gradient(70%_140%_at_0%_0%,rgba(245,158,11,0.18),transparent_60%)] dark:bg-[radial-gradient(70%_140%_at_0%_0%,rgba(251,191,36,0.2),transparent_60%)]"
									: "bg-[radial-gradient(70%_140%_at_0%_0%,rgba(14,165,233,0.16),transparent_60%)] dark:bg-[radial-gradient(70%_140%_at_0%_0%,rgba(96,165,250,0.2),transparent_60%)]"
							)}
						/>
						<div className="flex items-center gap-3">
							<div
								className={cn(
									"flex size-10 shrink-0 items-center justify-center bg-background/70 ring-1 backdrop-blur-sm",
									isClosedSeason
										? "text-amber-600 ring-amber-500/40 dark:text-amber-300"
										: "text-sky-600 ring-sky-500/40 dark:text-sky-300"
								)}
							>
								<HugeiconsIcon icon={Link01Icon} className="size-5" />
							</div>
							<div className="flex min-w-0 flex-col gap-1">
								<span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
									Public link
								</span>
								<DialogTitle className="text-xl font-black tracking-tight">
									{isClosedSeason ? "Share season recap" : "Share standings"}
								</DialogTitle>
							</div>
						</div>
						<DialogDescription>
							{isClosedSeason
								? "Anyone with the link can view the champion, podium, highlights and final standings."
								: "Anyone with the link can view this season's standings — names, points and recent form."}{" "}
							Revoke it at any time.
						</DialogDescription>
					</DialogHeader>

					<div className="overflow-y-auto p-6">
						{settingQuery.isPending ? (
							<Skeleton className="h-32 w-full" />
						) : !allowPublicShares ? (
							<div className="flex flex-col items-start gap-4 bg-muted/40 p-5 ring-1 ring-foreground/10">
								<div className="flex items-start gap-3">
									<div className="flex size-9 shrink-0 items-center justify-center bg-background ring-1 ring-foreground/10">
										<HugeiconsIcon icon={LockIcon} className="size-4 text-muted-foreground" />
									</div>
									<div>
										<p className="text-sm font-semibold">Public sharing is off for this league</p>
										<p className="mt-1 text-sm text-muted-foreground">
											{isOwner
												? "Turn it on to create links. You can turn it off again at any time — doing so revokes every active link."
												: "Ask a league owner to enable public sharing before creating a link."}
										</p>
									</div>
								</div>
								{isOwner && (
									<GlowButton
										icon={Share01Icon}
										glowColor={glowColors.blue}
										size="sm"
										className="gap-1.5"
										onClick={() => settingMutation.mutate(true)}
										disabled={settingMutation.isPending}
										data-testid="enable-public-sharing"
									>
										Enable sharing
									</GlowButton>
								)}
							</div>
						) : (
							<div className="flex flex-col gap-6">
								<section className="flex flex-col gap-3">
									<SectionLabel>Link duration</SectionLabel>
									<div className="grid grid-cols-5 gap-px bg-foreground/10 ring-1 ring-foreground/10">
										{EXPIRY_OPTIONS.map((option) => {
											const isSelected = expiresIn === option.value;
											return (
												<button
													key={option.value}
													type="button"
													aria-pressed={isSelected}
													onClick={() => setExpiresIn(option.value)}
													className={cn(
														"flex flex-col items-center gap-0.5 px-1 py-2.5 text-center transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring",
														isSelected
															? "bg-amber-500/12 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200"
															: "bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground"
													)}
													data-testid={`share-expiry-${option.value}`}
												>
													<span className="text-sm font-black tabular-nums tracking-tight">
														{option.short}
													</span>
													<span className="text-[10px] uppercase tracking-[0.14em]">
														{option.unit}
													</span>
												</button>
											);
										})}
									</div>
									{expiresIn === "never" && (
										<p className="text-xs text-muted-foreground">
											Never-expiring links stay live until you revoke them or disable sharing.
										</p>
									)}
									<GlowButton
										icon={Link01Icon}
										glowColor={glowColors.amber}
										size="sm"
										className="gap-1.5 self-start"
										onClick={() => createMutation.mutate()}
										disabled={createMutation.isPending}
										data-testid="create-share-link"
									>
										{createMutation.isPending ? "Creating…" : "Create link"}
									</GlowButton>
								</section>

								{created && (
									<section className="relative isolate flex flex-col gap-3 overflow-hidden p-4 ring-1 ring-emerald-500/30">
										<div
											aria-hidden="true"
											className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(90%_120%_at_100%_0%,rgba(16,185,129,0.14),transparent_60%)] dark:bg-[radial-gradient(90%_120%_at_100%_0%,rgba(52,211,153,0.18),transparent_60%)]"
										/>
										<div className="flex items-center justify-between gap-3">
											<span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
												<HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
												Link ready — copy it now
											</span>
											<span className="text-[11px] text-muted-foreground">
												{expiryLabel(created.expiresAt)}
											</span>
										</div>
										<div className="flex gap-2">
											<Input
												readOnly
												value={created.url}
												onFocus={(event) => event.currentTarget.select()}
												className="bg-background/80 font-mono text-xs"
											/>
											<Button
												size="sm"
												variant="outline"
												className="gap-1.5"
												onClick={() => void copyLink(created.url)}
												data-testid="copy-share-link"
											>
												<HugeiconsIcon icon={Copy01Icon} className="size-4" />
												<span className="hidden sm:inline">Copy</span>
											</Button>
										</div>
										<p className="text-[11px] text-muted-foreground">
											It won't be shown again — only a hash is stored.
										</p>
									</section>
								)}

								<section className="flex flex-col gap-3">
									<div className="flex items-baseline justify-between gap-3">
										<SectionLabel>Links for this season</SectionLabel>
										{activeLinks.length > 0 && (
											<span className="text-[11px] text-muted-foreground tabular-nums">
												{activeLinks.length} active
											</span>
										)}
									</div>
									{linksQuery.isPending ? (
										<Skeleton className="h-14 w-full" />
									) : activeLinks.length === 0 && inactiveLinks.length === 0 ? (
										<p className="border border-dashed border-foreground/15 px-4 py-5 text-center text-sm text-muted-foreground">
											No links yet.
										</p>
									) : (
										<ul className="divide-y divide-border border">
											{[...activeLinks, ...inactiveLinks].map((link) => (
												<li
													key={link.id}
													className={cn(
														"flex items-center justify-between gap-3 px-3 py-2.5 text-sm",
														link.revokedAt && "opacity-60"
													)}
												>
													<div className="flex min-w-0 items-center gap-3">
														<span
															aria-hidden="true"
															className={cn(
																"size-2 shrink-0 rounded-full",
																link.revokedAt ? "bg-muted-foreground/40" : "bg-emerald-500"
															)}
														/>
														<div className="min-w-0">
															<p className="truncate font-medium">
																{link.revokedAt ? "Revoked" : expiryLabel(link.expiresAt)}
															</p>
															<p className="truncate text-xs text-muted-foreground">
																{link.createdByName ?? "Unknown"} · {link.viewCount}{" "}
																{link.viewCount === 1 ? "view" : "views"}
															</p>
														</div>
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
								</section>

								{isOwner && (
									<section className="flex items-center justify-between gap-4 bg-muted/40 p-4 ring-1 ring-foreground/10">
										<div>
											<p className="text-sm font-semibold">Allow public share links</p>
											<p className="text-xs text-muted-foreground">
												Turning this off revokes every active link for this league.
											</p>
										</div>
										<Switch
											checked={allowPublicShares}
											onCheckedChange={(checked) => settingMutation.mutate(checked)}
											disabled={settingMutation.isPending}
										/>
									</section>
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
