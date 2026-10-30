import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "monitors.json");
const statusPath = path.join(root, "data", "status.json");
const historyPath = path.join(root, "data", "history.json");

function validTarget(target) {
  if (!target || typeof target !== "object") return false;
  if (typeof target.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,39}$/i.test(target.id)) return false;
  if (typeof target.name !== "string" || !target.name.trim()) return false;
  try {
    const url = new URL(target.url);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function checkTarget(target, timeoutMs = 10000) {
  const started = performance.now();
  try {
    const response = await fetch(target.url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "user-agent": "PulseWatch/1.0 (+https://github.com/PauzeDevs/PulseWatch)",
        "range": "bytes=0-0"
      }
    });
    const responseTimeMs = Math.round(performance.now() - started);
    try { await response.body?.cancel(); } catch {}
    const status = response.status < 400 ? "operational" : response.status < 500 ? "degraded" : "down";
    return {
      id: target.id,
      name: target.name.trim(),
      url: target.url,
      status,
      statusCode: response.status,
      responseTimeMs,
      checkedAt: new Date().toISOString(),
      error: null
    };
  } catch (error) {
    return {
      id: target.id,
      name: target.name.trim(),
      url: target.url,
      status: "down",
      statusCode: null,
      responseTimeMs: Math.round(performance.now() - started),
      checkedAt: new Date().toISOString(),
      error: error?.name === "TimeoutError" || error?.name === "AbortError"
        ? "Request timed out"
        : String(error?.message || "Request failed").slice(0, 180)
    };
  }
}

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function runChecks() {
  const config = await readJson(configPath, { checks: {}, monitors: [] });
  const targets = Array.isArray(config.monitors) ? config.monitors : [];
  if (targets.length === 0) {
    console.log("No monitors configured. Add targets to monitors.json; no status data was changed.");
    return { checked: 0 };
  }

  const ids = new Set();
  for (const target of targets) {
    if (!validTarget(target)) throw new Error(`Invalid monitor entry: ${JSON.stringify(target)}`);
    if (ids.has(target.id)) throw new Error(`Duplicate monitor id: ${target.id}`);
    ids.add(target.id);
  }

  const timeoutMs = Math.min(30000, Math.max(1000, Number(config.checks?.timeoutMs) || 10000));
  const historyLimit = Math.min(2016, Math.max(12, Number(config.checks?.historyLimit) || 288));
  const previousHistory = await readJson(historyPath, { schemaVersion: 1, monitors: {} });
  const checkedAt = new Date().toISOString();
  const results = await Promise.all(targets.map(target => checkTarget(target, timeoutMs)));
  const history = previousHistory.monitors || {};

  for (const result of results) {
    const samples = Array.isArray(history[result.id]) ? history[result.id] : [];
    samples.push({
      checkedAt: result.checkedAt,
      status: result.status,
      statusCode: result.statusCode,
      responseTimeMs: result.responseTimeMs
    });
    history[result.id] = samples.slice(-historyLimit);
    const successful = history[result.id].filter(item => item.status === "operational").length;
    result.uptimePercent = Number(((successful / history[result.id].length) * 100).toFixed(2));
    result.samples = history[result.id].length;
  }

  await mkdir(path.dirname(statusPath), { recursive: true });
  await writeFile(statusPath, JSON.stringify({
    schemaVersion: 1,
    checkedAt,
    monitors: results
  }, null, 2) + "\n");
  await writeFile(historyPath, JSON.stringify({
    schemaVersion: 1,
    monitors: history
  }, null, 2) + "\n");

  for (const result of results) {
    console.log(`[${result.status.toUpperCase()}] ${result.name}: HTTP ${result.statusCode ?? "ERR"} · ${result.responseTimeMs} ms · ${result.uptimePercent}% sample availability`);
  }
  return { checked: results.length, results };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runChecks().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
