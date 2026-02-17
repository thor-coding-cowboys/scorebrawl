from __future__ import annotations

import numpy as np
import sounddevice as sd


SAMPLE_RATE = 16000
CHANNELS = 1
BLOCK_SIZE = 1024


def record_until_silence(
    silence_threshold: float = 0.01,
    silence_duration: float = 1.5,
    max_duration: float = 15.0,
) -> np.ndarray:
    """Record audio from the default mic, stopping after silence is detected.

    Returns a 1D float32 numpy array at 16kHz mono.
    """
    chunks: list[np.ndarray] = []
    silent_blocks = 0
    blocks_for_silence = int(silence_duration * SAMPLE_RATE / BLOCK_SIZE)
    max_blocks = int(max_duration * SAMPLE_RATE / BLOCK_SIZE)
    has_speech = False

    with sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype="float32",
        blocksize=BLOCK_SIZE,
    ) as stream:
        for _ in range(max_blocks):
            data, _overflowed = stream.read(BLOCK_SIZE)
            chunks.append(data.copy())

            rms = float(np.sqrt(np.mean(data**2)))

            if rms >= silence_threshold:
                has_speech = True
                silent_blocks = 0
            else:
                silent_blocks += 1

            # Only stop on silence if we've heard some speech first
            if has_speech and silent_blocks >= blocks_for_silence:
                break

    if not chunks:
        return np.array([], dtype=np.float32)

    audio = np.concatenate(chunks, axis=0).flatten()
    return audio
