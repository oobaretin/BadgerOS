#!/usr/bin/env node
import { existsSync, rmSync } from "node:fs";
import { execSync, spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const cssPath = path.join(root, ".next/static/css/app/layout.css");
const nextDir = path.join(root, ".next");

async function probeUrl(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : "fetch failed" };
  }
}

async function probeHealthyDev() {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const home = await probeUrl("http://localhost:3000/");
    if (home.status !== 200) {
      await new Promise((r) => setTimeout(r, 750));
      continue;
    }
    const css = await probeUrl("http://localhost:3000/_next/static/css/app/layout.css");
    if (css.ok) return { home, css };
    return { home, css, brokenCss: true };
  }
  return null;
}

function portPids(port) {
  try {
    return execSync(`lsof -ti :${port}`, { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(Number);
  } catch {
    return [];
  }
}

function processCmd(pid) {
  try {
    return execSync(`ps -p ${pid} -o command=`, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function isNextDevPid(pid) {
  const cmd = processCmd(pid).toLowerCase();
  return cmd.includes("next") || cmd.includes("node");
}

function isFaceServerPid(pid) {
  return processCmd(pid).includes("face_server.py");
}

function freePort(port, kind) {
  const pids = [...new Set(portPids(port))];
  for (const pid of pids) {
    const cmd = processCmd(pid);
    const isOurs = kind === "next" ? isNextDevPid(pid) : isFaceServerPid(pid);
    if (!isOurs) continue;
    console.log(`[badgeros] Releasing port ${port} (pid ${pid})…`);
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
}

const forceClean = process.argv.includes("--clean");
const cssMissing = existsSync(nextDir) && !existsSync(cssPath);
const productionBuildCache =
  existsSync(nextDir) && existsSync(path.join(nextDir, "export-marker.json"));
const port3000InUse = portPids(3000).length > 0;
const needsClean = forceClean || cssMissing || productionBuildCache;

const healthy = await probeHealthyDev();
if (healthy?.home.ok && healthy.css.ok) {
  console.log("[badgeros] Dev server already running on http://localhost:3000 — skipping restart.");
  process.exit(0);
}

if (healthy && !healthy.home.ok) {
  console.log("[badgeros] Server on :3000 returned errors — restarting after cache clear.");
}

if (healthy?.brokenCss) {
  console.log("[badgeros] Server on :3000 but CSS is broken — restarting after cache clear.");
}

if (needsClean && port3000InUse) {
  console.log("[badgeros] Stopping existing Next.js on :3000 before cache clear…");
  freePort(3000, "next");
  await new Promise((r) => setTimeout(r, 2000));
}

if (needsClean) {
  if (productionBuildCache && !forceClean) {
    console.log(
      "[badgeros] Production build cache detected (npm run build) — clearing .next before dev…"
    );
  } else if (cssMissing && !forceClean) {
    console.log("[badgeros] Stale .next cache detected (layout.css missing) — clearing…");
  }
  rmSync(nextDir, { recursive: true, force: true });
}

freePort(3000, "next");
freePort(5001, "face");
await new Promise((r) => setTimeout(r, 1000));

const child = spawn('npx concurrently --kill-others-on-fail "next dev" "npm run face"', {
  stdio: "inherit",
  shell: true,
  cwd: root,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
