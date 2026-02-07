# Skill: scorebrawl-database-debug

Quick SQLite database debugging for Scorebrawl development.

## Connect to Database

```bash
cd apps/worker
sqlite3 ../../.db/local/v3/d1/miniflare-D1DatabaseObject/*.sqlite
.headers on
.mode table
```

## Essential Queries

### Find IDs
```sql
-- Get league/season IDs
SELECT id, slug FROM league WHERE slug = 'league-slug';
SELECT id, slug FROM season WHERE league_id = 'league_id';
```

### Current Standings
```sql
-- ELO standings for a season
SELECT sp.score, u.name, COUNT(mp.id) as matches
FROM season_player sp 
JOIN player p ON sp.player_id = p.id 
JOIN user u ON p.user_id = u.id 
LEFT JOIN match_player mp ON mp.season_player_id = sp.id
WHERE sp.season_id = 'season_id'
GROUP BY sp.id ORDER BY sp.score DESC;
```

### Today's Point Changes (+/- Column)
```sql
-- Debug +/- column values
SELECT mp.season_player_id,
       SUM(mp.score_after - mp.score_before) as point_diff,
       u.name
FROM match_player mp 
JOIN season_player sp ON mp.season_player_id = sp.id 
JOIN player p ON sp.player_id = p.id 
JOIN user u ON p.user_id = u.id 
WHERE sp.season_id = 'season_id'
  AND strftime('%Y-%m-%d', datetime(mp.created_at, 'unixepoch')) = strftime('%Y-%m-%d', 'now', 'localtime')
GROUP BY mp.season_player_id;
```

### Recent Matches
```sql
-- Last 10 matches in season
SELECT m.home_score, m.away_score,
       strftime('%Y-%m-%d %H:%M', datetime(m.created_at, 'unixepoch')) as match_date
FROM match m 
WHERE m.season_id = 'season_id' 
ORDER BY m.created_at DESC LIMIT 10;
```

## Common Issues

**Date queries**: Use `datetime(timestamp_col, 'unixepoch')` for Unix timestamps
**Empty +/- column**: Check if today's matches exist with correct date conversion
**Wrong standings**: Verify season_id and check match_player score_before/after values

## Quick Debug Session
1. Find league: `SELECT id FROM league WHERE slug = 'slug';`
2. Find season: `SELECT id FROM season WHERE league_id = 'id';` 
3. Check today's matches: Use point changes query above
4. Verify ELO updates: Check recent matches query