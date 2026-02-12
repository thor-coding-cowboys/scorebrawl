# Tallyo - ScoreBrawl Companion Device

> Voice-activated match recording device for ScoreBrawl

## Overview

A Raspberry Pi-based companion device that sits on the gaming table and allows players to register matches via voice commands. Eliminates the friction of manual match entry.

## Device Features

- **Voice-activated**: "Hey Tallyo, John beat Sarah 3-1"
- **All team sizes**: 1v1, doubles, and team matches
- **Multiple leagues**: Switch between leagues via voice
- **Always confirm**: Speaks back the result for confirmation before submitting
- **Local processing**: Privacy-first, runs LLM locally

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Tallyo Device                        │
│  ┌─────────────┐   ┌─────────────┐   ┌──────────────┐  │
│  │ Microphone  │──▶│ Wake Word   │──▶│ Voice-to-    │  │
│  │             │   │ Detection   │   │ Text (STT)   │  │
│  └─────────────┘   └─────────────┘   └──────────────┘  │
│                                             │          │
│                                             ▼          │
│  ┌─────────────┐   ┌─────────────┐   ┌──────────────┐  │
│  │ Speaker     │◀──│ Response    │◀──│ Intent       │  │
│  │ (feedback)  │   │ Generator   │   │ Parser (LLM) │  │
│  └─────────────┘   └─────────────┘   └──────────────┘  │
│                                             │          │
│                                             ▼          │
│                                      ┌──────────────┐  │
│                                      │ ScoreBrawl   │  │
│                                      │ API Client   │──┼──▶ ScoreBrawl API
│                                      └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Hardware Requirements

| Component    | Recommendation                          | Cost          |
| ------------ | --------------------------------------- | ------------- |
| SBC          | Raspberry Pi 5 (4GB)                    | ~$60          |
| Microphone   | ReSpeaker 2-Mic Pi HAT or USB mic array | ~$30-50       |
| Speaker      | Small 3W speaker                        | ~$10          |
| LED Ring     | NeoPixel ring (optional)                | ~$15          |
| Power Supply | Official Pi 5 PSU                       | ~$15          |
| MicroSD      | 32GB+                                   | ~$15          |
| Case         | Custom 3D printed                       | ~$20          |
| **Total**    |                                         | **~$150-170** |

---

## Software Stack

| Layer          | Technology                                                                                                        | Purpose                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Wake Word      | [OpenWakeWord](https://github.com/dscripka/openWakeWord) or [Porcupine](https://picovoice.ai/platform/porcupine/) | "Hey Tallyo" detection  |
| Speech-to-Text | [Whisper.cpp](https://github.com/ggerganov/whisper.cpp) (tiny/base)                                               | Local transcription     |
| Intent Parsing | [Llama 3.2 3B](https://ollama.com/library/llama3.2) via Ollama                                                    | Natural language → JSON |
| Text-to-Speech | [Piper TTS](https://github.com/rhasspy/piper)                                                                     | Voice responses         |
| Runtime        | Python 3.11+                                                                                                      | Application glue        |

---

## Voice Interaction Flow

### Example: Recording a Match

1. **User**: "Hey Tallyo, John beat Sarah 3-1"
2. **Wake word detected** → LED turns blue
3. **STT transcribes** → `"John beat Sarah 3-1"`
4. **LLM parses**:
   ```json
   {
     "intent": "record_match",
     "home_players": ["John"],
     "away_players": ["Sarah"],
     "home_score": 3,
     "away_score": 1
   }
   ```
5. **Tallyo**: "Recording John 3, Sarah 1. Say yes to confirm."
6. **User**: "Yes"
7. **API call** → Match created
8. **Tallyo**: "Match recorded. John's new rating is 1532."

### Supported Commands

| Command Type    | Examples                                           |
| --------------- | -------------------------------------------------- |
| Record match    | "John beat Sarah 3-1", "3-1 to John against Sarah" |
| Doubles         | "John and Mike beat Sarah and Dave 5-3"            |
| Teams           | "Team A beat Team B 2-0"                           |
| Switch league   | "Switch to Ping Pong league"                       |
| Check standings | "What are the standings?"                          |
| Undo            | "Cancel that" / "Undo"                             |

---

## Backend Changes Required

### 1. API Key System

New authentication mechanism for devices:

```typescript
// New table: deviceApiKey
{
  id: string,
  key: string,          // hashed
  userId: string,       // owner
  name: string,         // "Living room Tallyo"
  scopes: string[],     // ["match:create", "league:read"]
  lastUsedAt: timestamp,
  createdAt: timestamp
}
```

### 2. Device API Endpoints

| Endpoint                            | Method | Purpose                     |
| ----------------------------------- | ------ | --------------------------- |
| `/api/device/keys`                  | POST   | Create new device API key   |
| `/api/device/leagues`               | GET    | List user's leagues         |
| `/api/device/leagues/:slug/context` | GET    | Get players, current season |
| `/api/device/leagues/:slug/matches` | POST   | Create match                |

### 3. Fuzzy Player Matching

Device sends player names as spoken. Backend matches to actual players using fuzzy search (Levenshtein distance). Returns candidates if ambiguous.

---

## Device Software Structure

```
tallyo/
├── main.py                 # Main event loop
├── config.yaml             # Device settings
├── audio/
│   ├── wake_word.py        # Wake word detection
│   ├── stt.py              # Speech-to-text (Whisper)
│   └── tts.py              # Text-to-speech (Piper)
├── llm/
│   ├── intent_parser.py    # LLM intent extraction
│   └── prompts.py          # System prompts
├── api/
│   ├── client.py           # ScoreBrawl API client
│   └── models.py           # Data models
├── hardware/
│   ├── led.py              # LED status indicator
│   └── button.py           # Physical button (optional)
└── setup/
    └── pair_device.py      # Initial pairing wizard
```

---

## LLM System Prompt

```
You are a match result parser for ScoreBrawl. Extract structured data from voice input.

Current league: "{league_name}"
Known players: {player_list}

Output JSON only:
{
  "intent": "record_match" | "switch_league" | "standings" | "cancel" | "help" | "unknown",
  "home_players": ["name"],
  "away_players": ["name"],
  "home_score": number | null,
  "away_score": number | null,
  "target_league": "league name" | null,
  "confidence": 0.0-1.0
}

Parsing rules:
- "X beat Y N-M" → home: X (N), away: Y (M)
- "X lost to Y N-M" → home: Y (M), away: X (N)
- "N-M X vs Y" → home: X (N), away: Y (M)
- Multiple players: "X and Y beat A and B" → teams
```

---

## Implementation Phases

### Phase 1: Backend API (1-2 weeks) ✅

**Goal:** Add device authentication and endpoints to ScoreBrawl

- [x] Create `deviceApiKey` schema and migrations
- [x] Add API key auth middleware for `/api/device/*` routes
- [x] Implement device endpoints
- [x] Add fuzzy player name matching
- [x] Write integration tests (13 tests passing)
- [ ] Web UI for managing device keys (optional)

### Phase 2: Hardware Setup (1 week)

**Goal:** Raspberry Pi with audio I/O working

- [ ] Set up Raspberry Pi 5 with Raspberry Pi OS Lite
- [ ] Configure USB/HAT microphone
- [ ] Install and test Whisper.cpp (tiny model)
- [ ] Install and test Piper TTS
- [ ] Basic audio pipeline test

### Phase 3: Wake Word & Voice Pipeline (1 week)

**Goal:** "Hey Tallyo" triggers listening

- [ ] Train custom wake word
- [ ] Implement state machine: idle → listening → processing → responding
- [ ] Add timeout handling
- [ ] LED feedback integration

### Phase 4: LLM Intent Parsing (1 week)

**Goal:** Natural language → structured match data

- [ ] Install Ollama + Llama 3.2 3B
- [ ] Design and test system prompt
- [ ] Implement intent parser with validation
- [ ] Handle edge cases (unknown players, ambiguous input)

### Phase 5: End-to-End Integration (1 week)

**Goal:** Full flow working

- [ ] Device pairing flow
- [ ] API client with retry logic
- [ ] Full conversation flow
- [ ] Error handling

### Phase 6: Polish & Packaging (1 week)

**Goal:** Production-ready device

- [ ] Startup service (systemd)
- [ ] OTA update mechanism
- [ ] 3D printed enclosure design
- [ ] Documentation

---

## Open Questions

- [ ] Physical button for "done talking" or pure silence detection?
- [ ] Small OLED display for visual feedback?
- [ ] Offline queue for matches when network unavailable?
- [ ] Multiple wake word options ("Hey Tallyo", "Hey Ref", etc.)?

---

## Alternative Name Suggestions

| Name        | Notes                         |
| ----------- | ----------------------------- |
| Tallyo      | Play on "tally" - recommended |
| Brawly      | Derived from ScoreBrawl       |
| RefBot      | Referee Bot                   |
| Puck        | Small, sits on table          |
| Whistle     | Like a referee's whistle      |
| Scorekeeper | Direct, functional            |
