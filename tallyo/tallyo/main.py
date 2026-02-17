from __future__ import annotations

import sys
from enum import Enum
from pathlib import Path

import yaml
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

from tallyo.api_client import ScoreBrawlClient
from tallyo.audio import record_until_silence
from tallyo.models import IntentType, LeagueContext, MatchIntent
from tallyo.parser import parse_intent
from tallyo.stt import transcribe
from tallyo.tts import speak

console = Console()


class State(str, Enum):
    IDLE = "idle"
    LISTENING = "listening"
    PROCESSING = "processing"
    CONFIRMING = "confirming"
    SUBMITTING = "submitting"


def load_config() -> dict:
    config_path = Path(__file__).parent.parent / "config.yaml"
    if not config_path.exists():
        console.print("[red]config.yaml not found. Copy config.yaml and fill in your settings.[/red]")
        sys.exit(1)
    with open(config_path) as f:
        return yaml.safe_load(f)


def print_status(state: State, detail: str = "") -> None:
    colors = {
        State.IDLE: "dim",
        State.LISTENING: "red bold",
        State.PROCESSING: "yellow",
        State.CONFIRMING: "cyan",
        State.SUBMITTING: "green",
    }
    style = colors.get(state, "white")
    label = f"[{style}][{state.value.upper()}][/{style}]"
    if detail:
        label += f" {detail}"
    console.print(label)


def format_match_summary(intent: MatchIntent) -> str:
    home = " & ".join(intent.home_players)
    away = " & ".join(intent.away_players)
    return f"{home} {intent.home_score}, {away} {intent.away_score}"


def listen_for_confirmation(config: dict) -> bool:
    """Record and transcribe a yes/no response."""
    print_status(State.CONFIRMING, "Listening for yes or no...")
    audio = record_until_silence(
        silence_threshold=config.get("silence_threshold", 0.01),
        silence_duration=config.get("silence_duration", 1.5),
    )
    text = transcribe(audio, model_size=config.get("whisper_model", "base.en"))
    console.print(f"  Heard: [italic]{text}[/italic]")
    return "yes" in text.lower() or "yeah" in text.lower() or "yep" in text.lower()


def run() -> None:
    config = load_config()
    api_url = config["api_url"]
    api_key = config["api_key"]
    league_slug = config["default_league"]
    whisper_model = config.get("whisper_model", "base.en")
    ollama_model = config.get("ollama_model", "llama3.2:3b")
    silence_threshold = config.get("silence_threshold", 0.01)
    silence_duration = config.get("silence_duration", 1.5)

    if api_key == "sb_dev_xxxxx":
        console.print("[red]Please set your API key in config.yaml[/red]")
        sys.exit(1)

    client = ScoreBrawlClient(api_url, api_key)

    # Fetch league context
    console.print(f"\nConnecting to [bold]{api_url}[/bold]...")
    try:
        ctx: LeagueContext = client.get_context(league_slug)
    except Exception as e:
        console.print(f"[red]Failed to fetch league context: {e}[/red]")
        sys.exit(1)

    player_names = [p.name for p in ctx.players]
    console.print(
        Panel(
            f"[bold]{ctx.league.name}[/bold]\n"
            f"Season: {ctx.season.name if ctx.season else 'None'}\n"
            f"Players: {', '.join(player_names) or 'None'}",
            title="Tallyo",
            border_style="blue",
        )
    )

    if not ctx.season:
        console.print("[red]No active season found. Create a season first.[/red]")
        sys.exit(1)

    # Preload Whisper model
    console.print("Loading Whisper model...", style="dim")
    transcribe(__import__("numpy").zeros(16000, dtype="float32"), model_size=whisper_model)
    console.print("Ready!\n", style="green bold")

    # Main loop
    while True:
        try:
            # IDLE
            print_status(State.IDLE)
            input("Press Enter to speak (Ctrl+C to quit)... ")

            # LISTENING
            print_status(State.LISTENING, "Recording...")
            audio = record_until_silence(
                silence_threshold=silence_threshold,
                silence_duration=silence_duration,
            )

            # PROCESSING
            print_status(State.PROCESSING, "Transcribing...")
            text = transcribe(audio, model_size=whisper_model)
            if not text:
                console.print("  [dim]No speech detected, try again.[/dim]")
                continue
            console.print(f'  Heard: [italic]"{text}"[/italic]')

            print_status(State.PROCESSING, "Parsing intent...")
            intent = parse_intent(text, player_names, ctx.league.name, model=ollama_model)

            if intent.intent != IntentType.RECORD_MATCH:
                console.print("  [yellow]Could not parse a match result. Try again.[/yellow]")
                speak("Sorry, I didn't understand that. Try again.")
                continue

            # CONFIRMING
            summary = format_match_summary(intent)
            console.print(f"  Match: [bold]{summary}[/bold]")
            speak(f"Recording {summary}. Say yes to confirm.")

            if not listen_for_confirmation(config):
                console.print("  [yellow]Cancelled.[/yellow]")
                speak("Cancelled.")
                continue

            # SUBMITTING
            print_status(State.SUBMITTING, "Creating match...")
            try:
                result = client.create_match(
                    league_slug=league_slug,
                    season_slug=ctx.season.slug,
                    home_player_names=intent.home_players,
                    away_player_names=intent.away_players,
                    home_score=intent.home_score,
                    away_score=intent.away_score,
                )
                home = " and ".join(result.match.home_players)
                away = " and ".join(result.match.away_players)
                msg = f"Match recorded. {home} {result.match.home_score}, {away} {result.match.away_score}."
                console.print(f"  [green]{msg}[/green]")
                speak(msg)
            except Exception as e:
                error_msg = str(e)
                console.print(f"  [red]API error: {error_msg}[/red]")
                speak("Sorry, there was an error recording the match.")

            console.print()

        except KeyboardInterrupt:
            console.print("\n[dim]Goodbye![/dim]")
            client.close()
            break


def main() -> None:
    run()


if __name__ == "__main__":
    main()
