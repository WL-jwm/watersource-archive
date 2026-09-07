# -*- coding: utf-8 -*-
"""watersource-archive 静态服务启动器（供计划任务调用，pythonw 静默运行）

启动 http.server 绑定 0.0.0.0:8080，服务 dist 目录；启动时写日志便于诊断。
"""
import os
import sys
import threading
import http.server
import socketserver


class LoggingHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        try:
            with open(LOG_PATH, "a", encoding="utf-8") as f:
                f.write("req " + (fmt % args) + "\n")
        except Exception:
            pass

LOG_PATH = r"F:\Claw\20260430-17-06-02-805\20260508-14-56-40-793\watersource-archive\server.log"
DIST = r"F:\Claw\20260430-17-06-02-805\20260508-14-56-40-793\watersource-archive\dist"
PORT = 8080
ADDR = "0.0.0.0"


def log(msg):
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(msg + "\n")
    except Exception:
        pass


def serve():
    os.chdir(DIST)
    handler = LoggingHandler
    try:
        with socketserver.TCPServer((ADDR, PORT), handler) as httpd:
            log(f"server started {ADDR}:{PORT} dist={DIST} pid={os.getpid()}")
            httpd.serve_forever()
    except Exception as e:
        log(f"server error: {e}")


if __name__ == "__main__":
    log(f"launch pid={os.getpid()} cwd={os.getcwd()} python={sys.executable}")
    t = threading.Thread(target=serve, daemon=True)
    t.start()
    t.join()
