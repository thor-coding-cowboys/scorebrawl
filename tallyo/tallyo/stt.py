from __future__ import annotations

import numpy as np
from faster_whisper import WhisperModel

_model: WhisperModel | None = None


def _get_model(model_size: str = "base.en") -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(model_size, compute_type="int8")
    return _model


def transcribe(audio: np.ndarray, model_size: str = "base.en") -> str:
    """Transcribe a 16kHz float32 audio array to text."""
    if audio.size == 0:
        return ""

    model = _get_model(model_size)
    segments, _info = model.transcribe(audio, beam_size=5, language="en")
    text = " ".join(seg.text.strip() for seg in segments)
    return text.strip()
