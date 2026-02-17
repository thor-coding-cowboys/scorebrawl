from __future__ import annotations

import subprocess


def speak(text: str) -> None:
    """Speak text using macOS `say` command."""
    subprocess.run(["say", text], check=False)
