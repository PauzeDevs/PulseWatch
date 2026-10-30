import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { checkTarget } from "../scripts/check.mjs";

async function withServer(handler, run) {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try { await run(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test("classifies a 200 response as operational and records latency", async () => {
  await withServer((_req, res) => { res.writeHead(200); res.end("ok"); }, async url => {
    const result = await checkTarget({ id: "test-up", name: "Test up", url });
    assert.equal(result.status, "operational");
    assert.equal(result.statusCode, 200);
    assert.ok(result.responseTimeMs >= 0);
    assert.equal(result.error, null);
  });
});

test("classifies a 503 response as down", async () => {
  await withServer((_req, res) => { res.writeHead(503); res.end("unavailable"); }, async url => {
    const result = await checkTarget({ id: "test-down", name: "Test down", url });
    assert.equal(result.status, "down");
    assert.equal(result.statusCode, 503);
  });
});

test("classifies a 404 response as degraded", async () => {
  await withServer((_req, res) => { res.writeHead(404); res.end("missing"); }, async url => {
    const result = await checkTarget({ id: "test-degraded", name: "Test degraded", url });
    assert.equal(result.status, "degraded");
    assert.equal(result.statusCode, 404);
  });
});
