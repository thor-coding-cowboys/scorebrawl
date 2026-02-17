from __future__ import annotations

import httpx

from tallyo.models import CreateMatchResponse, LeagueContext


class APIError(Exception):
    def __init__(self, status: int, detail: str) -> None:
        self.status = status
        self.detail = detail
        super().__init__(detail)


class ScoreBrawlClient:
    def __init__(self, base_url: str, api_key: str) -> None:
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"),
            headers={"x-api-key": api_key},
            timeout=15.0,
        )

    def get_context(self, league_slug: str) -> LeagueContext:
        resp = self._client.get(f"/api/device/leagues/{league_slug}/context")
        resp.raise_for_status()
        return LeagueContext.model_validate(resp.json())

    def create_match(
        self,
        league_slug: str,
        season_slug: str,
        home_player_names: list[str],
        away_player_names: list[str],
        home_score: int,
        away_score: int,
    ) -> CreateMatchResponse:
        resp = self._client.post(
            f"/api/device/leagues/{league_slug}/matches",
            json={
                "seasonSlug": season_slug,
                "homePlayerNames": home_player_names,
                "awayPlayerNames": away_player_names,
                "homeScore": home_score,
                "awayScore": away_score,
            },
        )
        try:
            body = resp.json()
        except Exception:
            if resp.status_code >= 400:
                raise APIError(resp.status_code, f"HTTP {resp.status_code}: {resp.text}")
            raise APIError(resp.status_code, f"Empty response (HTTP {resp.status_code})")

        if resp.status_code >= 400:
            detail = body.get("error", str(body)) if isinstance(body, dict) else str(body)
            unmatched = body.get("unmatchedPlayers") if isinstance(body, dict) else None
            if unmatched:
                detail += f" (unmatched: {', '.join(unmatched)})"
            raise APIError(resp.status_code, detail)
        return CreateMatchResponse.model_validate(body)

    def close(self) -> None:
        self._client.close()
