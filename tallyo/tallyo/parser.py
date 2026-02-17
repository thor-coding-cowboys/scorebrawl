from __future__ import annotations

import json
import re

import ollama

from tallyo.models import IntentType, MatchIntent

SYSTEM_PROMPT = """\
You are Tallyo, a voice-activated match recorder for a gaming league.

Your job is to parse spoken match results into structured JSON. The user will say things like:
- "John beat Sarah 3 to 1"
- "Mike and Dave versus Tom and Jerry, 2-0"
- "Alice won against Bob 11 to 7"

Extract the match result and respond with ONLY a JSON object (no other text):
{{
  "intent": "record_match",
  "home_players": ["winner_name"],
  "away_players": ["loser_name"],
  "home_score": <higher_score>,
  "away_score": <lower_score>
}}

Rules:
- The winner/first-mentioned team is "home" with the higher score
- If the user says "X beat Y 3-1", X is home with 3, Y is away with 1
- If the user says "X vs Y, 2-0", X is home with 2, Y is away with 0
- Player names should match the available players as closely as possible
- If you cannot parse a match result, respond with: {{"intent": "unknown"}}

Available players in this league: {player_names}
League: {league_name}
"""


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
            home_players=data.get("home_players", []),
            away_players=data.get("away_players", []),
            home_score=int(data.get("home_score", 0)),
            away_score=int(data.get("away_score", 0)),
            raw_text=text,
        )
    except (json.JSONDecodeError, ValueError):
        return MatchIntent(intent=IntentType.UNKNOWN, raw_text=text)
