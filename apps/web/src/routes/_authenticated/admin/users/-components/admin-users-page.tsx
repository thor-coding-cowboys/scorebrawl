import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { trpcClient } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 25;

type AdminUser = {
	id: string;
	name: string;
	email: string;
	image: string | null;
	createdAt: Date;
};

type Stats = {
	totalUsers: number;
	newUsersThisWeek: number;
	newUsersPrevWeek: number;
	bannedUsers: number;
};

function formatRelativeDate(date: Date | null): string {
	if (!date) return "—";
	const d = new Date(date);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMins = Math.floor(diffMs / (1000 * 60));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 365) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Avatar({ user }: { user: AdminUser }) {
	if (user.image) {
		return (
			<img src={user.image} alt={user.name} className="h-7 w-7 object-cover ring-1 ring-border" />
		);
	}
	const initials = user.name
		.split(" ")
		.map((n) => n[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();
	const colors = [
		"bg-blue-500",
		"bg-violet-500",
		"bg-emerald-500",
		"bg-amber-500",
		"bg-rose-500",
		"bg-cyan-500",
		"bg-fuchsia-500",
		"bg-lime-500",
	];
	const colorIdx = user.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % colors.length;
	return (
		<div
			className={`flex h-7 w-7 items-center justify-center text-[0.6rem] font-semibold text-white ${colors[colorIdx]}`}
		>
			{initials}
		</div>
	);
}

function StatCard({
	label,
	description,
	value,
	change,
	changeLabel,
	loading,
}: {
	label: string;
	description: string;
	value?: number;
	change?: number;
	changeLabel?: string;
	loading: boolean;
}) {
	const isPositive = change !== undefined && change > 0;
	const isNeutral = change === undefined || change === 0;

	return (
		<div className="flex flex-col gap-3 border border-border bg-card p-5">
			<div>
				<div className="text-sm font-medium">{label}</div>
				<div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
			</div>
			{loading ? (
				<Skeleton className="h-10 w-12" />
			) : (
				<div className="text-4xl font-semibold tracking-tight">{value ?? 0}</div>
			)}
			{changeLabel && (
				<div
					className={`flex items-center gap-1.5 text-xs font-medium ${
						isNeutral ? "text-muted-foreground" : isPositive ? "text-emerald-500" : "text-rose-500"
					}`}
				>
					{isNeutral ? <span>—</span> : isPositive ? <span>↑</span> : <span>↓</span>}
					{loading ? (
						<Skeleton className="h-3 w-24" />
					) : (
						<span>
							{isNeutral ? "0%" : `${isPositive ? "+" : ""}${change}%`} {changeLabel}
						</span>
					)}
				</div>
			)}
		</div>
	);
}

export function AdminUsersPage() {
	const { data: session } = authClient.useSession();
	const [offset, setOffset] = useState(0);

	const { data: stats, isPending: statsLoading } = useQuery<Stats>({
		queryKey: ["admin", "stats"],
		queryFn: async () => {
			return await trpcClient.admin.stats.query();
		},
	});

	const { data: usersPage, isPending: usersLoading } = useQuery({
		queryKey: ["admin", "users", offset],
		queryFn: async () => {
			return await trpcClient.admin.users.query({
				limit: PAGE_SIZE,
				offset,
			});
		},
	});

	const today = new Date().toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
	});

	const weekChangePercent = stats
		? stats.newUsersPrevWeek === 0
			? stats.newUsersThisWeek > 0
				? 100
				: 0
			: Math.round(
					((stats.newUsersThisWeek - stats.newUsersPrevWeek) / stats.newUsersPrevWeek) * 100
				)
		: undefined;

	const totalPages = usersPage ? Math.ceil(usersPage.total / PAGE_SIZE) : 0;
	const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

	return (
		<div className="container mx-auto p-6 space-y-8">
			{/* Header */}
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">
					Welcome back, {session?.user?.name}
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">{today}</p>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<StatCard
					label="Total Users"
					description="All registered accounts"
					value={stats?.totalUsers}
					loading={statsLoading}
				/>
				<StatCard
					label="New Users This Week"
					description="Signed up in the last 7 days"
					value={stats?.newUsersThisWeek}
					change={weekChangePercent}
					changeLabel="from previous week"
					loading={statsLoading}
				/>
				<StatCard
					label="Banned Users"
					description="Currently banned accounts"
					value={stats?.bannedUsers}
					loading={statsLoading}
				/>
			</div>

			{/* Users table */}
			<div className="border border-border bg-card">
				<div className="flex items-center justify-between border-b border-border px-5 py-4">
					<h2 className="text-sm font-semibold">Users</h2>
					{!statsLoading && (
						<span className="text-xs text-muted-foreground">{stats?.totalUsers ?? 0} total</span>
					)}
				</div>

				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-border">
								{["Joined", "Name", "Email"].map((h) => (
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
							{usersLoading
								? Array.from({ length: 8 }).map((_row, i) => (
										<tr key={`skeleton-row-${i}`} className="border-b border-border">
											{Array.from({ length: 3 }).map((_col, j) => (
												<td key={`skeleton-cell-${i}-${j}`} className="px-5 py-3.5">
													<Skeleton className="h-4" style={{ width: `${[60, 120, 160][j]}px` }} />
												</td>
											))}
										</tr>
									))
								: usersPage?.users.map((user: AdminUser, i: number) => (
										<tr
											key={user.id}
											className={`transition hover:bg-muted/50 ${i < usersPage.users.length - 1 ? "border-b border-border" : ""}`}
										>
											<td className="whitespace-nowrap px-5 py-3.5 text-xs text-muted-foreground">
												{formatRelativeDate(user.createdAt)}
											</td>
											<td className="px-5 py-3.5">
												<div className="flex items-center gap-2.5">
													<Avatar user={user} />
													<span className="font-medium">{user.name}</span>
												</div>
											</td>
											<td className="px-5 py-3.5 text-muted-foreground">{user.email}</td>
										</tr>
									))}
						</tbody>
					</table>
				</div>

				{/* Pagination */}
				{totalPages > 1 && (
					<div className="flex items-center justify-between border-t border-border px-5 py-3">
						<span className="text-xs text-muted-foreground">
							Page {currentPage} of {totalPages}
						</span>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
								disabled={offset === 0}
								className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:border-muted-foreground disabled:cursor-not-allowed disabled:opacity-40"
							>
								Previous
							</button>
							<button
								type="button"
								onClick={() => setOffset(offset + PAGE_SIZE)}
								disabled={currentPage >= totalPages}
								className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:border-muted-foreground disabled:cursor-not-allowed disabled:opacity-40"
							>
								Next
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
