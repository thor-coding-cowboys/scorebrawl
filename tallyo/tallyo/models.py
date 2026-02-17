from __future__ import annotations

from enum import Enum
from pydantic import BaseModel, ConfigDict


class IntentType(str, Enum):
    RECORD_MATCH = "record_match"
    UNKNOWN = "unknown"


class MatchIntent(BaseModel):
    intent: IntentType = IntentType.UNKNOWN
    home_players: list[str] = []
    away_players: list[str] = []
    home_score: int = 0
    away_score: int = 0
    raw_text: str = ""


class LeagueInfo(BaseModel):
    id: str
    name: str
    slug: str


class SeasonInfo(BaseModel):
    id: str
    name: str
    slug: str


class PlayerInfo(BaseModel):
    id: str
    name: str
    score: float


class LeagueContext(BaseModel):
    league: LeagueInfo
    season: SeasonInfo | None = None
    players: list[PlayerInfo] = []


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=lambda s: "".join(
        w if i == 0 else w.capitalize() for i, w in enumerate(s.split("_"))
    ), populate_by_name=True)


class MatchResult(CamelModel):
    id: str
    home_score: int
    away_score: int
    home_players: list[str]
    away_players: list[str]


class CreateMatchResponse(CamelModel):
    success: bool
    match: MatchResult
