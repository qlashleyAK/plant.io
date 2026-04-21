#!/usr/bin/env bash
set -eu

: "${DEVICE:=/dev/video0}"
: "${RESOLUTION:=1280x720}"
: "${FPS:=10}"
: "${PORT:=8080}"
: "${HOST:=0.0.0.0}"
: "${FORMAT:=MJPEG}"
: "${DROP_SAME_FRAMES:=30}"
: "${QUALITY:=80}"
: "${EXTRA_ARGS:=}"

echo "[camera] device=${DEVICE} res=${RESOLUTION} fps=${FPS} format=${FORMAT} port=${PORT}"

exec ustreamer \
  --device="${DEVICE}" \
  --resolution="${RESOLUTION}" \
  --desired-fps="${FPS}" \
  --format="${FORMAT}" \
  --host="${HOST}" \
  --port="${PORT}" \
  --drop-same-frames="${DROP_SAME_FRAMES}" \
  --quality="${QUALITY}" \
  --allow-origin='*' \
  --persistent \
  ${EXTRA_ARGS}
