#!/bin/bash
# 重启一个带 SwiftShader WebGL 的 Chrome 实例
PORT="${1:-9222}"
PROFILE="${2:-/tmp/chrome-fox2}"

# 结束占用该端口的实例（排除本脚本自身）
for pid in $(pgrep -f "remote-debugging-port=${PORT}" 2>/dev/null); do
  [ "$pid" != "$$" ] && kill "$pid" 2>/dev/null
done
sleep 1

export DISPLAY=unix:/mnt/wslg/.X11-unix/X0
exec /home/zjh/.hermes/tools/chromium-1208/chrome-linux64/chrome \
  --no-sandbox --disable-dev-shm-usage --no-first-run --no-default-browser-check \
  --disable-gpu-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader \
  --remote-debugging-port="${PORT}" --user-data-dir="${PROFILE}" \
  --window-size=1600,1000 about:blank