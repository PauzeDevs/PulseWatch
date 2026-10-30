import test from "node:test";
import assert from "node:assert/strict";

await import("../assets/site-probe.js");
const probe = globalThis.PulseWatchProbe;

test("accepts public HTTPS domain URLs", () => {
  const url = probe.parseHttpsUrl("https://example.com/status");
  assert.equal(url.hostname, "example.com");
  assert.equal(url.pathname, "/status");
});

test("rejects plain HTTP URLs", () => {
  assert.throws(() => probe.parseHttpsUrl("http://example.com"), /HTTPS is required/);
});

test("rejects IP literals, local names, credentials and non-standard ports", () => {
  assert.throws(() => probe.parseHttpsUrl("https://127.0.0.1"), /public domain/);
  assert.throws(() => probe.parseHttpsUrl("https://localhost"), /public domain/);
  assert.throws(() => probe.parseHttpsUrl("https://user:pass@example.com"), /usernames or passwords/);
  assert.throws(() => probe.parseHttpsUrl("https://example.com:8443"), /standard HTTPS port/);
});

test("resolves public A records and rejects private addresses", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ Status: 0, Answer: [{ type: 1, data: "93.184.216.34" }] })
    });
    const addresses = await probe.resolvePublicDomain("example.com");
    assert.deepEqual(addresses, ["93.184.216.34"]);

    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ Status: 0, Answer: [{ type: 1, data: "127.0.0.1" }] })
    });
    await assert.rejects(probe.resolvePublicDomain("internal.example"), /private or reserved/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("returns HTTP status when the target allows browser CORS", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 200 });
    const result = await probe.probeHttps("https://example.com");
    assert.equal(result.kind, "operational");
    assert.equal(result.statusCode, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reports reachability without guessing status when CORS hides it", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  try {
    globalThis.fetch = async (_url, options) => {
      attempts += 1;
      if (options.mode === "cors") throw new TypeError("CORS blocked");
      return { type: "opaque", body: null };
    };
    const result = await probe.probeHttps("https://example.com");
    assert.equal(attempts, 2);
    assert.equal(result.kind, "reachable");
    assert.equal(result.statusCode, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reports unreachable when both browser connection attempts fail", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new TypeError("Network error"); };
    const result = await probe.probeHttps("https://example.com");
    assert.equal(result.kind, "unreachable");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
