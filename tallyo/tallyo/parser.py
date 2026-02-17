from __future__ import annotations

import difflib
import json
import re

import ollama

from tallyo.models import IntentType, MatchIntent

SYSTEM_PROMPT = """\
You are Tallyo, a voice-activated match recorder for a gaming league.

Your job is to parse spoken match results into structured JSON. The input comes from \
speech-to-text and WILL contain transcription errors in player names.

CRITICAL: You MUST map every player name to the closest match from the available players \
list below. The speech-to-text often mishears names — e.g. "Crystal" means "Christopher", \
"Danny" means "Daniel", "marks" means "Mark". Always use the FIRST NAME from the available \
players list in your output.

Available players: {player_names}

The user will say things like:
- "John beat Sarah 3 to 1"
- "Mike and Dave versus Tom and Jerry, 2-0"
- "Alice won against Bob 11 to 7"

Respond with ONLY a JSON object (no other text):
{{
  "intent": "record_match",
  "home_players": ["first_name_from_list"],
  "away_players": ["first_name_from_list"],
  "home_score": <score>,
  "away_score": <score>
}}

Rules:
- The winner/first-mentioned team is "home" with their score
- If the user says "X beat Y 3-1", X is home with 3, Y is away with 1
- ALWAYS correct misspelled/misheard names to the closest available player
- Use first names only (e.g. "Christopher" not "Christopher Arnarson")
- If you cannot parse a match result, respond with: {{"intent": "unknown"}}

League: {league_name}
"""


def _fuzzy_match_name(name: str, player_names: list[str]) -> str:
    """Match a possibly-misheard name to the closest player name."""
    # Build lookup of first names and full names
    first_names = {n.split()[0].lower(): n.split()[0] for n in player_names}
    all_candidates = list(first_names.keys()) + [n.lower() for n in player_names]

    needle = name.lower().strip()

    # Exact first-name match
    if needle in first_names:
        return first_names[needle]

    # Fuzzy match against first names (cutoff 0.5 to catch phonetic variants)
    matches = difflib.get_close_matches(needle, first_names.keys(), n=1, cutoff=0.5)
    if matches:
        return first_names[matches[0]]

    # Fuzzy match against full names
    full_matches = difflib.get_close_matches(needle, [n.lower() for n in player_names], n=1, cutoff=0.5)
    if full_matches:
        idx = [n.lower() for n in player_names].index(full_matches[0])
        return player_names[idx].split()[0]

    # No match — return original, let the API try
    return name


def _fix_names(names: list[str], player_names: list[str]) -> list[str]:
    return [_fuzzy_match_name(n, player_names) for n in names]


def parse_intent(
    text: str,
    player_names: list[str],
    league_name: str,
    model: str = "llama3.2:3b",
) -> MatchIntent:
    """Parse a spoken utterance into a match intent using Ollama."""
    system = SYSTEM_PROMPT.format(
        player_names=", ".join(player_names),
        league_name=league_name,
    )

    response = ollama.chat(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": text},
        ],
        options={"temperature": 0},
    )

    raw = response.message.content or ""

    # Extract JSON from the response (LLM might wrap it in markdown)
    json_match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not json_match:
        return MatchIntent(intent=IntentType.UNKNOWN, raw_text=text)

    try:
        data = json.loads(json_match.group())
        return MatchIntent(
            intent=IntentType(data.get("intent", "unknown")),
            home_players=_fix_names(data.get("home_players", []), player_names),
            away_players=_fix_names(data.get("away_players", []), player_names),
            home_score=int(data.get("home_score", 0)),
            away_score=int(data.get("away_score", 0)),
            raw_text=text,
        )
    except (json.JSONDecodeError, ValueError):
        return MatchIntent(intent=IntentType.UNKNOWN, raw_text=text)
