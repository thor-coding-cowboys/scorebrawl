#!/usr/bin/env bash
set -euo pipefail

SDK_DIR="$HOME/Library/Application Support/Garmin/ConnectIQ/Sdks/connectiq-sdk-mac-8.4.1-2026-02-03-e9f77eeaa/bin"
export PATH="$PATH:$SDK_DIR"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
JUNGLE="$SCRIPT_DIR/monkey.jungle"
BUILD_DIR="$SCRIPT_DIR/build"
PRG="$BUILD_DIR/ScoreBrawl.prg"
SETTINGS="$BUILD_DIR/ScoreBrawl-settings.json"
KEY="$SCRIPT_DIR/developer_key.der"
DEVICE="${1:-venu2}"

mkdir -p "$BUILD_DIR"

echo "==> Building for $DEVICE..."
monkeyc -f "$JUNGLE" -o "$PRG" -d "$DEVICE" -y "$KEY" -w

echo "==> Starting simulator (waiting for it to load)..."
connectiq &
sleep 6

echo "==> Sideloading app..."
monkeydo "$PRG" "$DEVICE"
