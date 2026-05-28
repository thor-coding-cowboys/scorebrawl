import { createFileRoute } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useState, useEffect, useCallback } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";

const searchSchema = z.object({
	user_code: z.string().default(""),
});

export const Route = createFileRoute("/device/")({
	validateSearch: zodValidator(searchSchema),
	component: DevicePage,
});

type State = "login" | "loading" | "org-select" | "approve" | "success" | "error";

type Org = { id: string; name: string };

function DevicePage() {
	const { user_code } = Route.useSearch();
	const code = user_code.replace(/-/g, "").toUpperCase();

	const { data: session, isPending: sessionPending } = authClient.useSession();

	const [state, setState] = useState<State>("loading");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loginError, setLoginError] = useState("");
	const [loginLoading, setLoginLoading] = useState(false);
	const [orgs, setOrgs] = useState<Org[]>([]);
	const [approveError, setApproveError] = useState("");
	const [approveLoading, setApproveLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");

	const verifyAndFetchOrgs = useCallback(async () => {
		setState("loading");
		const res = await fetch(`/api/auth/device?user_code=${code}`, {
			credentials: "include",
		});
		if (!res.ok) {
			const body = (await res.json().catch(() => ({}))) as { error_description?: string };
			setErrorMessage(body.error_description || "Invalid or expired device code.");
			setState("error");
			return;
		}
		const { data: orgList } = await authClient.organization.list();
		setOrgs((orgList ?? []) as Org[]);
		setState("org-select");
	}, [code]);

	useEffect(() => {
		if (sessionPending) return;
		if (!session) {
			setState("login");
		} else {
			void verifyAndFetchOrgs();
		}
	}, [sessionPending, session, verifyAndFetchOrgs]);

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoginError("");
		setLoginLoading(true);
		const { error } = await authClient.signIn.email({
			email,
			password,
			callbackURL: undefined as never,
		});
		if (error) {
			setLoginError(error.message || "Invalid email or password.");
			setLoginLoading(false);
			return;
		}
		setLoginLoading(false);
		await verifyAndFetchOrgs();
	};

	const handleOrgSelect = async (orgId: string) => {
		await authClient.organization.setActive({ organizationId: orgId });
		setState("approve");
	};

	const handleApprove = async () => {
		setApproveError("");
		setApproveLoading(true);
		const res = await fetch("/api/auth/device/approve", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ userCode: code }),
		});
		if (res.ok) {
			setState("success");
		} else {
			setApproveError("Approval failed. Please try again.");
			setApproveLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Authorize Device</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{user_code && (
						<div>
							<p className="text-sm text-muted-foreground">Your device code:</p>
							<p className="mt-1 inline-block rounded bg-muted px-3 py-1 text-xl font-bold tracking-widest">
								{user_code}
							</p>
						</div>
					)}

					{state === "login" && (
						<form onSubmit={handleLogin} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="email">Email</Label>
								<Input
									id="email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									autoComplete="email"
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="password">Password</Label>
								<Input
									id="password"
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									autoComplete="current-password"
									required
								/>
							</div>
							{loginError && <p className="text-sm text-destructive">{loginError}</p>}
							<Button type="submit" className="w-full" disabled={loginLoading}>
								{loginLoading ? "Signing in..." : "Sign In"}
							</Button>
						</form>
					)}

					{state === "loading" && (
						<p className="text-sm text-muted-foreground">Verifying device code...</p>
					)}

					{state === "org-select" && (
						<div className="space-y-4">
							<p className="text-sm">Select a league to scope this session to:</p>
							<Select onValueChange={(value: string | null) => { if (value) void handleOrgSelect(value); }}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{orgs.map((org) => (
										<SelectItem key={org.id} value={org.id}>
											{org.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					{state === "approve" && (
						<div className="space-y-4">
							<p className="text-sm">Allow this device to access your account?</p>
							{approveError && <p className="text-sm text-destructive">{approveError}</p>}
							<Button className="w-full" onClick={handleApprove} disabled={approveLoading}>
								{approveLoading ? "Approving..." : "Approve"}
							</Button>
						</div>
					)}

					{state === "success" && (
						<p className="text-sm text-green-600">Device authorized! You can close this tab.</p>
					)}

					{state === "error" && <p className="text-sm text-destructive">{errorMessage}</p>}
				</CardContent>
			</Card>
		</div>
	);
}
