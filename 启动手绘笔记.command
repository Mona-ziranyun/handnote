#!/bin/bash
# 双击运行：启动本地服务并在浏览器打开「大纲转手写笔记」
cd "$(dirname "$0")"
PORT=5288
if ! lsof -i :$PORT >/dev/null 2>&1; then
  python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 &
  sleep 1
fi
open "http://127.0.0.1:$PORT/"
echo "已在浏览器打开：http://127.0.0.1:$PORT/"
echo "使用期间请保持此窗口开着；关闭窗口即停止。"
wait
