#!/usr/bin/env bash
# 启动本地预览服务器：双击或在终端执行 ./start.sh
# 然后浏览器打开 http://127.0.0.1:8765/
cd "$(dirname "$0")" || exit 1

PORT=8765
if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -q ":${PORT} "; then
  echo "端口 ${PORT} 已在运行，直接访问： http://127.0.0.1:${PORT}/"
  exit 0
fi

echo "寒带赤狐已启动 → http://127.0.0.1:${PORT}/"
echo "按 Ctrl+C 停止。"
exec python3 -m http.server "${PORT}" --bind 127.0.0.1