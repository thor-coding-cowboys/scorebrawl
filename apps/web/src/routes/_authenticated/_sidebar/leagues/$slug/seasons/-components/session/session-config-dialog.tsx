import { useEffect, useReducer, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTRPC, trpcClient, type AnyTRPC } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GlowButton, glowColors } from "@/components/ui/glow-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AvatarWithFallback } from "@/components/ui/avatar-with-fallback";
import { SettingsRow } from "@/routes/-components/ui/settings-row";
import type { GameSession } from "@/routes/_authenticated/_sidebar/leagues/$slug/seasons/$seasonSlug/session/$sessionId/-components/session-types";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ArrowLeft01Icon,
	ArrowRight01Icon,
	Cancel01Icon,
	PlayIcon,
	Tick01Icon,
	SearchIcon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type RotationMode = "winner-stays" | "manual";
type Randomizer = "off" | "fisher-yates" | "diversity";

interface DialogState {
	rotationMode: RotationMode;
	teamSize: number;
	maxConsecutiveEnabled: boolean;
	maxConsecutiveGames: number;
	winnersTakePriority: boolean;
	randomizerType: Randomizer;
	autoCoinToss: boolean;
	selectedPlayerIds: string[];
	alwaysSplitPairs: [string, string][];
	splitPickA: string;
	splitPickB: string;
	playerSearch: string;
	mobileStep: number;
}

const initialState: DialogState = {
	rotationMode: "winner-stays",
	teamSize: 2,
	maxConsecutiveEnabled: true,
	maxConsecutiveGames: 3,
	winnersTakePriority: false,
	randomizerType: "fisher-yates",
	autoCoinToss: true,
	selectedPlayerIds: [],
	alwaysSplitPairs: [],
	splitPickA: "",
	splitPickB: "",
	playerSearch: "",
	mobileStep: 0,
};

function stateFromSession(session: GameSession): DialogState {
	const selectedPlayerIds = session.players
		.filter((p) => p.status !== "out")
		.map((p) => p.seasonPlayerId);
	return {
		rotationMode: session.rotationMode,
		teamSize: session.teamSize,
		maxConsecutiveEnabled: session.maxConsecutiveEnabled,
		maxConsecutiveGames: session.maxConsecutiveGames ?? 3,
		winnersTakePriority: session.winnersTakePriority,
		randomizerType: session.randomizerType,
		autoCoinToss: session.autoCoinToss,
		selectedPlayerIds,
		alwaysSplitPairs: session.alwaysSplitConstraints.filter(
			([a, b]) => selectedPlayerIds.includes(a) && selectedPlayerIds.includes(b)
		),
		splitPickA: "",
		splitPickB: "",
		playerSearch: "",
		mobileStep: 0,
	};
}

type Action =
	| { type: "SET_ROTATION_MODE"; value: RotationMode }
	| { type: "SET_TEAM_SIZE"; value: number }
	| { type: "SET_MAX_CONSECUTIVE_ENABLED"; value: boolean }
	| { type: "SET_MAX_CONSECUTIVE_GAMES"; value: number }
	| { type: "SET_WINNERS_TAKE_PRIORITY"; value: boolean }
	| { type: "SET_RANDOMIZER_TYPE"; value: Randomizer }
	| { type: "SET_AUTO_COIN_TOSS"; value: boolean }
	| { type: "TOGGLE_PLAYER"; id: string }
	| { type: "REMOVE_SPLIT_PAIR"; a: string; b: string }
	| { type: "SET_SPLIT_PICK_A"; value: string }
	| { type: "SET_SPLIT_PICK_B"; value: string }
	| { type: "SET_PLAYER_SEARCH"; value: string }
	| { type: "SET_MOBILE_STEP"; value: number }
	| { type: "INIT_FROM_SESSION"; session: GameSession }
	| { type: "RESET" };

function reducer(state: DialogState, action: Action): DialogState {
	switch (action.type) {
		case "SET_ROTATION_MODE":
			return { ...state, rotationMode: action.value };
		case "SET_TEAM_SIZE":
			return { ...state, teamSize: action.value };
		case "SET_MAX_CONSECUTIVE_ENABLED":
			return { ...state, maxConsecutiveEnabled: action.value };
		case "SET_MAX_CONSECUTIVE_GAMES":
			return { ...state, maxConsecutiveGames: action.value };
		case "SET_WINNERS_TAKE_PRIORITY":
			return { ...state, winnersTakePriority: action.value };
		case "SET_RANDOMIZER_TYPE":
			return { ...state, randomizerType: action.value };
		case "SET_AUTO_COIN_TOSS":
			return { ...state, autoCoinToss: action.value };
		case "TOGGLE_PLAYER": {
			const isRemoving = state.selectedPlayerIds.includes(action.id);
			if (isRemoving) {
				return {
					...state,
					alwaysSplitPairs: state.alwaysSplitPairs.filter((p) => !p.includes(action.id)),
					selectedPlayerIds: state.selectedPlayerIds.filter((id) => id !== action.id),
				};
			}
			return { ...state, selectedPlayerIds: [...state.selectedPlayerIds, action.id] };
		}
		case "REMOVE_SPLIT_PAIR":
			return {
				...state,
				alwaysSplitPairs: state.alwaysSplitPairs.filter(
					([pa, pb]) => !(pa === action.a && pb === action.b)
				),
			};
		case "SET_SPLIT_PICK_A": {
			const a = action.value;
			const b = state.splitPickB;
			if (!a || !b || a === b) return { ...state, splitPickA: a };
			const alreadyA = state.alwaysSplitPairs.some(
				(p) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a)
			);
			if (alreadyA) return { ...state, splitPickA: a };
			return {
				...state,
				alwaysSplitPairs: [...state.alwaysSplitPairs, [a, b]],
				splitPickA: "",
				splitPickB: "",
			};
		}
		case "SET_SPLIT_PICK_B": {
			const b = action.value;
			const a = state.splitPickA;
			if (!a || !b || a === b) return { ...state, splitPickB: b };
			const alreadyB = state.alwaysSplitPairs.some(
				(p) => (p[0] === a && p[1] === b) || (p[0] === b && p[1] === a)
			);
			if (alreadyB) return { ...state, splitPickB: b };
			return {
				...state,
				alwaysSplitPairs: [...state.alwaysSplitPairs, [a, b]],
				splitPickA: "",
				splitPickB: "",
			};
		}
		case "SET_PLAYER_SEARCH":
			return { ...state, playerSearch: action.value };
		case "SET_MOBILE_STEP":
			return { ...state, mobileStep: action.value };
		case "INIT_FROM_SESSION":
			return stateFromSession(action.session);
		case "RESET":
			return initialState;
	}
}

function SubmitButton({
	mode,
	isPending,
	onClick,
	className,
}: {
	mode: "create" | "edit";
	isPending: boolean;
	onClick: () => void;
	className?: string;
}) {
	return (
		<GlowButton
			glowColor={glowColors.emerald}
			onClick={onClick}
			disabled={isPending}
			className={className}
			data-testid="session-config-submit"
		>
			<HugeiconsIcon icon={PlayIcon} className="size-4" />
			{isPending
				? mode === "edit"
					? "Saving..."
					: "Starting..."
				: mode === "edit"
					? "Save Changes"
					: "Start Session"}
		</GlowButton>
	);
}

interface BaseProps {
	isOpen: boolean;
	onClose: () => void;
	seasonSlug: string;
	leagueSlug: string;
}

export type SessionConfigDialogProps = BaseProps &
	({ mode: "create"; session?: undefined } | { mode: "edit"; session: GameSession });

export function SessionConfigDialog(props: SessionConfigDialogProps) {
	const { isOpen, onClose, seasonSlug, leagueSlug } = props;
	const mode = props.mode;
	const session = props.mode === "edit" ? props.session : undefined;
	const navigate = useNavigate();
	const trpcTyped = useTRPC();
	const queryClient = useQueryClient();
	const client = trpcClient as AnyTRPC;

	const [state, dispatch] = useReducer(reducer, initialState);
	const wasOpenRef = useRef(false);

	useEffect(() => {
		const justOpened = isOpen && !wasOpenRef.current;
		wasOpenRef.current = isOpen;
		if (justOpened && session) {
			dispatch({ type: "INIT_FROM_SESSION", session });
		}
	}, [isOpen, session]);

	const { data: seasonPlayers } = useQuery(
		trpcTyped.seasonPlayer.getStanding.queryOptions({ seasonSlug })
	);

	const createSession = useMutation({
		mutationFn: (input: {
			seasonSlug: string;
			rotationMode: RotationMode;
			teamSize: number;
			maxConsecutiveGames: number | null;
			maxConsecutiveEnabled: boolean;
			winnersTakePriority: boolean;
			seasonPlayerIds: string[];
			alwaysSplitConstraints: [string, string][];
			randomizerType: Randomizer;
			autoCoinToss: boolean;
		}) => client.session.create.mutate(input) as Promise<{ id: string }>,
		onSuccess: (created) => {
			void queryClient.invalidateQueries({ queryKey: ["session.active", seasonSlug] });
			onClose();
			dispatch({ type: "RESET" });
			navigate({
				to: "/leagues/$slug/seasons/$seasonSlug/session/$sessionId",
				params: { slug: leagueSlug, seasonSlug, sessionId: created.id },
			});
		},
		onError: () => {
			toast.error("Failed to start session");
		},
	});

	const saveChanges = useMutation({
		mutationFn: async () => {
			if (!session) return;
			const activeMembers = session.players.filter((p) => p.status !== "out");
			const initialIds = new Set(activeMembers.map((p) => p.seasonPlayerId));
			const currentIds = new Set(state.selectedPlayerIds);
			const toAdd = state.selectedPlayerIds.filter((id) => !initialIds.has(id));
			const toRemove = activeMembers.filter((p) => !currentIds.has(p.seasonPlayerId));

			await Promise.all([
				...toAdd.map((seasonPlayerId) =>
					client.session.addPlayer.mutate({ sessionId: session.id, seasonPlayerId })
				),
				...toRemove.map((p) =>
					client.session.removePlayer.mutate({ sessionId: session.id, sessionPlayerId: p.id })
				),
			]);

			await client.session.updateSettings.mutate({
				sessionId: session.id,
				teamSize: state.teamSize,
				maxConsecutiveEnabled: state.maxConsecutiveEnabled,
				maxConsecutiveGames: state.maxConsecutiveEnabled ? state.maxConsecutiveGames : null,
				winnersTakePriority: state.winnersTakePriority,
				randomizerType: state.randomizerType,
				autoCoinToss: state.autoCoinToss,
				alwaysSplitConstraints: state.alwaysSplitPairs,
			});
		},
		onSuccess: () => {
			if (session) {
				void queryClient.invalidateQueries({ queryKey: ["session", session.id] });
			}
			toast.success("Session updated");
			onClose();
		},
		onError: () => {
			toast.error("Failed to save session settings");
		},
	});

	const handleSubmit = () => {
		if (mode === "edit") {
			saveChanges.mutate();
			return;
		}
		createSession.mutate({
			seasonSlug,
			rotationMode: state.rotationMode,
			teamSize: state.teamSize,
			maxConsecutiveEnabled: state.maxConsecutiveEnabled,
			maxConsecutiveGames: state.maxConsecutiveEnabled ? state.maxConsecutiveGames : null,
			winnersTakePriority: state.winnersTakePriority,
			seasonPlayerIds: state.selectedPlayerIds,
			alwaysSplitConstraints: state.alwaysSplitPairs,
			randomizerType: state.randomizerType,
			autoCoinToss: state.autoCoinToss,
		});
	};

	const handleClose = () => {
		onClose();
		if (mode === "create") {
			setTimeout(() => dispatch({ type: "RESET" }), 200);
		}
	};

	const isPending = createSession.isPending || saveChanges.isPending;
	const playingSeasonPlayerIds = new Set(
		(session?.players ?? []).filter((p) => p.status === "playing").map((p) => p.seasonPlayerId)
	);

	const settingsPanel = (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Label>Rotation Mode</Label>
				<Select
					value={state.rotationMode}
					disabled={mode === "edit"}
					onValueChange={(v) => dispatch({ type: "SET_ROTATION_MODE", value: v as RotationMode })}
				>
					<SelectTrigger>
						<SelectValue>
							{state.rotationMode === "winner-stays" ? "Winner Stays" : "Manual"}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="winner-stays">Winner Stays</SelectItem>
						<SelectItem value="manual">Manual</SelectItem>
					</SelectContent>
				</Select>
			</div>

			<div className="flex flex-col gap-2">
				<Label>Team Size</Label>
				<Input
					type="number"
					min={1}
					max={6}
					value={state.teamSize}
					onChange={(e) =>
						dispatch({
							type: "SET_TEAM_SIZE",
							value: Math.max(1, Math.min(6, Number(e.target.value))),
						})
					}
				/>
			</div>

			{state.rotationMode === "winner-stays" && (
				<>
					<SettingsRow
						label="Winners Take Priority"
						description={["ON: winners go to top of queue", "OFF: winners placed above losers"]}
					>
						<Switch
							checked={state.winnersTakePriority}
							onCheckedChange={(v) => dispatch({ type: "SET_WINNERS_TAKE_PRIORITY", value: v })}
						/>
					</SettingsRow>

					<SettingsRow label="Max Consecutive Games" description="Limit how many games in a row">
						<Switch
							checked={state.maxConsecutiveEnabled}
							onCheckedChange={(v) => dispatch({ type: "SET_MAX_CONSECUTIVE_ENABLED", value: v })}
						/>
					</SettingsRow>
					{state.maxConsecutiveEnabled && (
						<Input
							type="number"
							min={1}
							max={20}
							value={state.maxConsecutiveGames}
							onChange={(e) =>
								dispatch({
									type: "SET_MAX_CONSECUTIVE_GAMES",
									value: Math.min(20, Math.max(1, Number(e.target.value))),
								})
							}
							className="w-24"
						/>
					)}
				</>
			)}

			{state.rotationMode !== "manual" && (
				<SettingsRow
					label="Auto Randomize"
					description={
						state.randomizerType === "off"
							? "No auto-shuffle - teams stay as manually arranged"
							: state.randomizerType === "fisher-yates"
								? "Pure random shuffle - every pairing equally likely"
								: "Prefer pairing players who haven't played together recently"
					}
				>
					<Select
						value={state.randomizerType}
						onValueChange={(v) =>
							dispatch({
								type: "SET_RANDOMIZER_TYPE",
								value: v as Randomizer,
							})
						}
					>
						<SelectTrigger className="w-32">
							<SelectValue>
								{state.randomizerType === "off"
									? "Off"
									: state.randomizerType === "fisher-yates"
										? "Fisher-Yates"
										: "Diversity"}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="off">Off</SelectItem>
							<SelectItem value="fisher-yates">Fisher-Yates</SelectItem>
							<SelectItem value="diversity">Diversity</SelectItem>
						</SelectContent>
					</Select>
				</SettingsRow>
			)}

			{state.rotationMode !== "manual" && (
				<SettingsRow label="Auto Coin Toss" description="Auto-resolve coin tosses">
					<Switch
						checked={state.autoCoinToss}
						onCheckedChange={(v) => dispatch({ type: "SET_AUTO_COIN_TOSS", value: v })}
					/>
				</SettingsRow>
			)}
		</div>
	);

	const playersPanel = (
		<div className="flex flex-1 min-h-0 flex-col gap-3">
			<div className="flex items-center justify-between shrink-0">
				<Label>Players</Label>
				<span className="text-xs text-muted-foreground">
					{state.selectedPlayerIds.length} selected
				</span>
			</div>
			{!seasonPlayers || seasonPlayers.length === 0 ? (
				<div className="flex h-24 items-center justify-center border text-sm text-muted-foreground">
					No players in this season
				</div>
			) : (
				<div className="border flex-1 min-h-0 flex flex-col">
					<div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
						<HugeiconsIcon icon={SearchIcon} className="size-4 text-muted-foreground shrink-0" />
						<Input
							type="text"
							placeholder="Search players..."
							value={state.playerSearch}
							onChange={(e) => dispatch({ type: "SET_PLAYER_SEARCH", value: e.target.value })}
							className="border-0 p-0 h-auto text-sm shadow-none focus-visible:ring-0"
						/>
					</div>
					<div className="flex flex-col min-h-[80px] flex-1 overflow-y-auto">
						{[...seasonPlayers]
							.sort((a, b) => b.matchCount - a.matchCount)
							.filter(
								(p) =>
									!state.playerSearch ||
									p.name.toLowerCase().includes(state.playerSearch.toLowerCase())
							)
							.map((player) => {
								const selected = state.selectedPlayerIds.includes(player.id);
								const inMatch = playingSeasonPlayerIds.has(player.id);
								return (
									<button
										key={player.id}
										type="button"
										disabled={inMatch}
										data-testid="session-player-option"
										onClick={() => dispatch({ type: "TOGGLE_PLAYER", id: player.id })}
										className={cn(
											"flex items-center gap-2 px-3 py-2 text-left transition-colors border-b border-border/50 last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
											selected && "bg-primary/10 border-l-2 border-l-primary",
											!selected && "hover:bg-muted/50",
											inMatch && "opacity-50 cursor-not-allowed"
										)}
									>
										<AvatarWithFallback src={player.image} name={player.name} size="sm" />
										<div className="min-w-0 flex-1">
											<p className="text-xs font-medium truncate">{player.name}</p>
											<p className="text-[0.65rem] text-muted-foreground font-mono">
												{player.score} · {player.matchCount} matches
											</p>
										</div>
										{inMatch && (
											<span className="text-[0.65rem] text-muted-foreground shrink-0">
												in match
											</span>
										)}
										{selected && !inMatch && (
											<HugeiconsIcon icon={Tick01Icon} className="size-3.5 text-primary shrink-0" />
										)}
									</button>
								);
							})}
					</div>
				</div>
			)}

			{state.selectedPlayerIds.length >= 2 &&
				seasonPlayers &&
				state.rotationMode === "winner-stays" && (
					<div className="flex flex-col gap-3 shrink-0">
						<div className="flex flex-col gap-0.5">
							<Label>Always Split</Label>
							<span className="text-xs text-muted-foreground">
								Pairs that must always be on opposite teams
							</span>
						</div>
						<div className="flex gap-2 items-center">
							<Select
								value={state.splitPickA}
								onValueChange={(v) => dispatch({ type: "SET_SPLIT_PICK_A", value: v ?? "" })}
							>
								<SelectTrigger className="flex-1 min-w-0">
									<SelectValue>
										{state.splitPickA ? (
											<span className="truncate">
												{seasonPlayers.find((p) => p.id === state.splitPickA)?.name}
											</span>
										) : (
											<span className="text-muted-foreground">Player A</span>
										)}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{seasonPlayers
										.filter(
											(p) => state.selectedPlayerIds.includes(p.id) && p.id !== state.splitPickB
										)
										.map((p) => (
											<SelectItem key={p.id} value={p.id}>
												{p.name}
											</SelectItem>
										))}
								</SelectContent>
							</Select>
							<Select
								value={state.splitPickB}
								onValueChange={(v) => dispatch({ type: "SET_SPLIT_PICK_B", value: v ?? "" })}
							>
								<SelectTrigger className="flex-1 min-w-0">
									<SelectValue>
										{state.splitPickB ? (
											<span className="truncate">
												{seasonPlayers.find((p) => p.id === state.splitPickB)?.name}
											</span>
										) : (
											<span className="text-muted-foreground">Player B</span>
										)}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{seasonPlayers
										.filter(
											(p) => state.selectedPlayerIds.includes(p.id) && p.id !== state.splitPickA
										)
										.map((p) => (
											<SelectItem key={p.id} value={p.id}>
												{p.name}
											</SelectItem>
										))}
								</SelectContent>
							</Select>
						</div>
						{state.alwaysSplitPairs.length > 0 && (
							<div className="divide-y divide-border border max-h-[132px] overflow-y-auto">
								{state.alwaysSplitPairs.map(([a, b]) => {
									const playerA = seasonPlayers.find((p) => p.id === a);
									const playerB = seasonPlayers.find((p) => p.id === b);
									return (
										<div key={`${a}-${b}`} className="flex items-center gap-2 px-3 py-2">
											<span className="text-sm truncate flex-1 text-right">{playerA?.name}</span>
											<span className="text-xs text-muted-foreground shrink-0">vs</span>
											<span className="text-sm truncate flex-1">{playerB?.name}</span>
											<Button
												type="button"
												size="icon-sm"
												variant="ghost"
												onClick={() => dispatch({ type: "REMOVE_SPLIT_PAIR", a, b })}
											>
												<HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
											</Button>
										</div>
									);
								})}
							</div>
						)}
					</div>
				)}
		</div>
	);

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
			<DialogContent className="sm:max-w-3xl h-[min(95vh,760px)] overflow-hidden p-0 flex flex-col">
				<div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.02]">
					<div
						className="w-full h-full"
						style={{
							backgroundImage:
								"radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
							backgroundSize: "24px 24px",
						}}
					/>
				</div>

				<DialogHeader className="relative z-10 border-b border-border px-6 py-3 shrink-0">
					<div className="flex items-center gap-3">
						<div className="w-2 h-5 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/25" />
						<DialogTitle className="text-base font-bold font-mono tracking-tight">
							{mode === "edit" ? "Session Settings" : "Start Session"}
						</DialogTitle>
					</div>
					<p className="text-xs text-muted-foreground mt-1">
						{mode === "edit"
							? "Update rotation rules and players. Changes apply to the next match."
							: "Configure rotation rules and select players."}
					</p>
				</DialogHeader>

				{/* Desktop: two-column layout */}
				<div className="relative z-10 flex-1 min-h-0 hidden sm:flex">
					<div className="w-[280px] shrink-0 border-r border-border p-6 overflow-y-auto">
						{settingsPanel}
					</div>
					<div className="flex-1 min-h-0 p-6 flex flex-col overflow-y-auto">{playersPanel}</div>
				</div>

				{/* Mobile: step-based layout */}
				<div className="relative z-10 flex-1 min-h-0 flex flex-col sm:hidden">
					<div className="flex border-b border-border shrink-0">
						<button
							type="button"
							onClick={() => dispatch({ type: "SET_MOBILE_STEP", value: 0 })}
							className={cn(
								"flex-1 px-4 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
								state.mobileStep === 0
									? "text-foreground border-b-2 border-primary"
									: "text-muted-foreground"
							)}
						>
							Settings
						</button>
						<button
							type="button"
							onClick={() => dispatch({ type: "SET_MOBILE_STEP", value: 1 })}
							className={cn(
								"flex-1 px-4 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
								state.mobileStep === 1
									? "text-foreground border-b-2 border-primary"
									: "text-muted-foreground"
							)}
						>
							Players
							{state.selectedPlayerIds.length > 0 && (
								<span className="ml-1.5 text-xs text-muted-foreground">
									({state.selectedPlayerIds.length})
								</span>
							)}
						</button>
					</div>
					<div className="flex-1 min-h-0 p-6 flex flex-col overflow-y-auto">
						{state.mobileStep === 0 ? settingsPanel : playersPanel}
					</div>
				</div>

				{/* Actions */}
				<div className="relative z-10 shrink-0 border-t border-border p-6 flex gap-3">
					{/* Mobile: back/next on step 0 */}
					<div className="flex sm:hidden gap-3 flex-1">
						{state.mobileStep === 0 ? (
							<>
								<Button type="button" variant="outline" onClick={handleClose}>
									Cancel
								</Button>
								<Button
									type="button"
									className="flex-1 gap-2"
									onClick={() => dispatch({ type: "SET_MOBILE_STEP", value: 1 })}
								>
									Players
									<HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
								</Button>
							</>
						) : (
							<>
								<Button
									type="button"
									variant="outline"
									className="gap-2"
									onClick={() => dispatch({ type: "SET_MOBILE_STEP", value: 0 })}
								>
									<HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
									Settings
								</Button>
								<SubmitButton
									mode={mode}
									isPending={isPending}
									onClick={handleSubmit}
									className="flex-1 gap-2"
								/>
							</>
						)}
					</div>
					{/* Desktop: cancel + submit */}
					<div className="hidden sm:flex gap-3 flex-1">
						<Button type="button" variant="outline" onClick={handleClose}>
							Cancel
						</Button>
						<SubmitButton
							mode={mode}
							isPending={isPending}
							onClick={handleSubmit}
							className="flex-1 gap-2"
						/>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
