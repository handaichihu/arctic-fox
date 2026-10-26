#!/usr/bin/env python3
"""测试不同 Chrome 启动参数下 WebGL 是否可用"""
import subprocess, time, os, signal, sys, random, shutil

CHROME = "/home/zjh/.hermes/tools/chromium-1208/chrome-linux64/chrome"
ENV = dict(os.environ)
ENV["DISPLAY"] = "unix:/mnt/wslg/.X11-unix/X0"

combos = [
    ("default", [], {}),
    ("egl", ["--use-gl=egl"], {}),
    ("egl-sw", ["--use-gl=egl"], {"LIBGL_ALWAYS_SOFTWARE": "1", "GALLIUM_DRIVER": "llvmpipe"}),
    ("angle-gl", ["--use-gl=angle", "--use-angle=gl"], {}),
    ("angle-vulkan", ["--use-gl=angle", "--use-angle=vulkan"], {}),
    ("swiftshader", ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"], {}),
    ("gl-desktop", ["--use-gl=desktop"], {}),
    ("disable-gpu-sandbox", ["--disable-gpu", "--enable-unsafe-swiftshader"], {}),
]

for name, args, extra_env in combos:
    port = 9300 + random.randint(0, 500)
    prof = f"/tmp/cf-{port}"
    shutil.rmtree(prof, ignore_errors=True)
    env = dict(ENV)
    env.update(extra_env)
    cmd = [CHROME, "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run",
           "--no-default-browser-check", f"--remote-debugging-port={port}",
           f"--user-data-dir={prof}", "--window-size=1200,800", "--disable-gpu-sandbox"] + args + ["about:blank"]
    p = subprocess.Popen(cmd, env=env, stdout=open(f"/tmp/chr-{port}.log", "w"), stderr=subprocess.STDOUT,
                         start_new_session=True)
    time.sleep(3.2)
    out = subprocess.run([sys.executable.replace("python3", "python3"), "-c", "pass"], capture_output=True)
    r = subprocess.run(["node", "/home/zjh/voxel-fox/tools/probe.js", str(port)],
                       capture_output=True, text=True, timeout=25)
    print(f"[{name:20s}] -> {r.stdout.strip() or r.stderr.strip()[:120]}", flush=True)
    try:
        os.killpg(os.getpgid(p.pid), signal.SIGTERM)
    except Exception:
        pass
    time.sleep(0.8)