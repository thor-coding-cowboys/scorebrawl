import { useReducer, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { trpcClient } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { SettingsRow } from "@/routes/-components/ui/settings-row";
import { toast } from "sonner";
import type { GameSession } from "./session-types";

interface SessionSettingsDialogProps {
	isOpen: boolean;
	onClose: () => void;
	session: GameSession;
	sessionId: string;
}

type RotationMode = "winner-stays" | "manual";

interface DialogState {
	rotationMode: RotationMode;
	teamSize: number;
	maxConsecutiveEnabled: boolean;
	maxConsecutiveGames: number;
	winnersTakePriority: boolean;
	randomizerType: "off" | "fisher-yates" | "diversity";
	autoCoinToss: boolean;
}

type Action =
	| { type: "SET_ROTATION_MODE"; value: RotationMode }
	| { type: "SET_TEAM_SIZE"; value: number }
	| { type: "SET_MAX_CONSECUTIVE_ENABLED"; value: boolean }
	| { type: "SET_MAX_CONSECUTIVE_GAMES"; value: number }
	| { type: "SET_WINNERS_TAKE_PRIORITY"; value: boolean }
	| { type: "SET_RANDOMIZER_TYPE"; value: "off" | "fisher-yates" | "diversity" }
	| { type: "SET_AUTO_COIN_TOSS"; value: boolean }
	| { type: "RESET"; session: GameSession };

function getInitialState(session: GameSession): DialogState {
	const isWinnerStays = session.rotationMode === "winner-stays";
	return {
		rotationMode: session.rotationMode,
		teamSize: session.teamSize,
		maxConsecutiveEnabled: isWinnerStays ? session.maxConsecutiveEnabled : false,
		maxConsecutiveGames: session.maxConsecutiveGames ?? 3,
		winnersTakePriority: isWinnerStays ? session.winnersTakePriority : false,
		randomizerType: session.autoRandomize ? session.randomizerType : "off",
		autoCoinToss: isWinnerStays ? session.autoCoinToss : false,
	};
}

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
		case "RESET":
			return getInitialState(action.session);
	}
}

export function SessionSettingsDialog({
	isOpen,
	onClose,
	session,
	sessionId,
}: SessionSettingsDialogProps) {
	const [state, dispatch] = useReducer(reducer, session, getInitialState);

	useEffect(() => {
		if (isOpen) {
			dispatch({ type: "RESET", session });
		}
	}, [isOpen, session]);

	const updateSettings = useMutation({
		mutationFn: (input: {
			sessionId: string;
			rotationMode: RotationMode;
			teamSize: number;
			maxConsecutiveEnabled: boolean;
			maxConsecutiveGames: number | null;
			winnersTakePriority: boolean;
			autoRandomize: boolean;
			autoCoinToss: boolean;
			randomizerType?: "fisher-yates" | "diversity";
		}) => trpcClient.session.updateSettings.mutate(input),
		onSuccess: () => {
			onClose();
		},
		onError: () => {
			toast.error("Failed to update settings");
		},
	});

	const handleSubmit = () => {
		const mutationInput = {
			sessionId,
			rotationMode: state.rotationMode,
			teamSize: state.teamSize,
			maxConsecutiveEnabled: state.maxConsecutiveEnabled,
			maxConsecutiveGames: state.maxConsecutiveEnabled ? state.maxConsecutiveGames : null,
			winnersTakePriority: state.winnersTakePriority,
			autoRandomize: state.randomizerType !== "off",
			autoCoinToss: state.autoCoinToss,
		};
		if (state.randomizerType !== "off") {
			updateSettings.mutate({ ...mutationInput, randomizerType: state.randomizerType });
		} else {
			updateSettings.mutate(mutationInput);
		}
	};

	const handleClose = () => {
		onClose();
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle className="text-base font-bold font-mono tracking-tight">
						Edit Session Settings
					</DialogTitle>
					<p className="text-xs text-muted-foreground mt-1">Changes apply to the next match.</p>
				</DialogHeader>

				<div className="flex flex-col gap-4 py-4">
					<div className="flex flex-col gap-2">
						<Label>Rotation Mode</Label>
						<Select
							value={state.rotationMode}
							onValueChange={(v) =>
								dispatch({ type: "SET_ROTATION_MODE", value: v as RotationMode })
							}
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

							<SettingsRow
								label="Max Consecutive Games"
								description="Limit how many games in a row"
							>
								<Switch
									checked={state.maxConsecutiveEnabled}
									onCheckedChange={(v) =>
										dispatch({ type: "SET_MAX_CONSECUTIVE_ENABLED", value: v })
									}
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
										value: v as "off" | "fisher-yates" | "diversity",
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

				<div className="flex gap-3">
					<Button type="button" variant="outline" onClick={handleClose}>
						Cancel
					</Button>
					<Button
						type="button"
						className="flex-1"
						onClick={handleSubmit}
						disabled={updateSettings.isPending}
					>
						{updateSettings.isPending ? "Saving..." : "Save Settings"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
