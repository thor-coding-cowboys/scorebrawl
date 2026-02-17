# Tallyo - Voice Match Recorder

Local Mac prototype that records ScoreBrawl matches via voice commands.

```
User speaks → Mic → Whisper STT → Ollama LLM → Confirm via TTS → ScoreBrawl API
```

## Prerequisites

- **Python 3.11+** with [uv](https://docs.astral.sh/uv/)
- **Ollama** with a model pulled (e.g., `ollama pull llama3.2:3b`)
- **PortAudio** for mic access (`brew install portaudio`)
- **ScoreBrawl** dev server running at `http://localhost:5173`

## Setup

1. Install dependencies:

```sh
cd tallyo
uv sync
```

2. Create an API key in the ScoreBrawl web UI (Settings → API Keys)

3. Edit `config.yaml` with your API key and league slug:

```yaml
api_url: http://localhost:5173
api_key: sb_dev_your_key_here
default_league: your-league-slug
```

4. Make sure Ollama is running with the model available:

```sh
ollama serve  # if not already running
ollama pull llama3.2:3b
```

## Usage

```sh
uv run python -m tallyo
```

1. Press **Enter** to start listening
2. Say something like **"John beat Sarah 3-1"**
3. Tallyo confirms: *"Recording John 3, Sarah 1. Say yes to confirm."*
4. Say **"yes"** to submit, or **"no"** to cancel
5. Match appears in ScoreBrawl

## Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `api_url` | `http://localhost:5173` | ScoreBrawl server URL |
| `api_key` | — | Your API key (required) |
| `default_league` | — | League slug to record matches in |
| `whisper_model` | `base.en` | Whisper model size |
| `ollama_model` | `llama3.2:3b` | Ollama model for intent parsing |
| `silence_threshold` | `0.01` | RMS threshold for silence detection |
| `silence_duration` | `1.5` | Seconds of silence before stopping |
