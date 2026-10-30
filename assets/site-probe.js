(function () {
  "use strict";

  const DNS_ENDPOINT = "https://dns.google/resolve";

  function isPublicIPv4(value) {
    const octets = value.split(".").map(Number);
    if (octets.length !== 4 || octets.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
    const [a,b,c] = octets;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 0 || b === 168)) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    if (a === 192 && b === 0 && c === 2) return false;
    return true;
  }

  function isPublicIPv6(value) {
    const ip = value.toLowerCase().split("%")[0];
    if (ip.startsWith("::ffff:") || ip === "::" || ip === "::1") return false;
    if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe8") ||
        ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb") ||
        ip.startsWith("ff") || ip.startsWith("2001:db8")) return false;
    return /^[23]/.test(ip);
  }

  function parseHttpsUrl(raw) {
    let url;
    try { url = new URL(String(raw || "").trim()); }
    catch { throw new Error("Enter a valid HTTPS website URL."); }
    if (url.protocol !== "https:") throw new Error("HTTPS is required. URLs beginning with HTTP are not accepted.");
    if (url.username || url.password) throw new Error("URLs containing usernames or passwords are not allowed.");
    if (url.port && url.port !== "443") throw new Error("Only the standard HTTPS port (443) is supported.");
    const host = url.hostname.toLowerCase();
    if (!host || !host.includes(".") || host === "localhost" || host.endsWith(".local") ||
        host.endsWith(".internal") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) {
      throw new Error("Enter a public domain name, not a local hostname or IP address.");
    }
    return url;
  }

  async function resolvePublicDomain(hostname) {
    const queries = ["A", "AAAA"];
    const replies = await Promise.all(queries.map(async type => {
      const url = new URL(DNS_ENDPOINT);
      url.searchParams.set("name", hostname);
      url.searchParams.set("type", type);
      const response = await fetch(url, {
        headers: { accept: "application/dns-json" },
        cache: "no-store",
        signal: AbortSignal.timeout(7000)
      });
      if (!response.ok) throw new Error("The public DNS resolver could not validate this domain.");
      return response.json();
    }));
    const answers = replies.flatMap(reply => reply.Status === 0 ? (reply.Answer || []) : []);
    const addresses = [...new Set(answers.filter(answer => answer.type === 1 || answer.type === 28).map(answer => answer.data))];
    if (!addresses.length) throw new Error("This domain has no public A or AAAA DNS record. Check the spelling or DNS settings.");
    const safe = addresses.every(address => address.includes(":") ? isPublicIPv6(address) : isPublicIPv4(address));
    if (!safe) throw new Error("This domain resolves to a private or reserved IP address and cannot be checked.");
    return addresses;
  }

  async function probeHttps(url) {
    const options = {
      method: "GET",
      mode: "cors",
      redirect: "manual",
      cache: "no-store",
      headers: { range: "bytes=0-0" },
      signal: AbortSignal.timeout(9000)
    };
    const startedAt = performance.now();
    try {
      const response = await fetch(url, options);
      const responseTimeMs = Math.round(performance.now() - startedAt);
      if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
        return { kind: "redirect", statusCode: response.status || null, responseTimeMs, message: "HTTPS endpoint responded with a redirect. Browser security hides the destination." };
      }
      try { await response.body?.cancel(); } catch {}
      if (response.status >= 500) return { kind: "down", statusCode: response.status, responseTimeMs, message: "The server returned an HTTP 5xx error." };
      if (response.status >= 400) return { kind: "degraded", statusCode: response.status, responseTimeMs, message: "The server returned an HTTP 4xx response." };
      return { kind: "operational", statusCode: response.status, responseTimeMs, message: "HTTPS request completed successfully." };
    } catch (corsOrNetworkError) {
      try {
        const opaqueStartedAt = performance.now();
        const opaque = await fetch(url, {
          method: "GET",
          mode: "no-cors",
          redirect: "manual",
          cache: "no-store",
          headers: { range: "bytes=0-0" },
          signal: AbortSignal.timeout(9000)
        });
        const responseTimeMs = Math.round(performance.now() - opaqueStartedAt);
        if (opaque.type === "opaqueredirect") {
          return { kind: "redirect", statusCode: null, responseTimeMs, message: "HTTPS endpoint responded with a redirect. The browser hides the final destination." };
        }
        try { await opaque.body?.cancel(); } catch {}
        return { kind: "reachable", statusCode: null, responseTimeMs, message: "HTTPS connection succeeded. This website blocks browser access to its HTTP status (CORS), so the exact status code is hidden." };
      } catch (networkError) {
        return { kind: "unreachable", statusCode: null, responseTimeMs: null, message: "DNS resolves, but the HTTPS endpoint could not be reached. Check its TLS certificate, server, or network restrictions." };
      }
    }
  }

  async function validateAndProbe(raw) {
    const url = parseHttpsUrl(raw);
    const addresses = await resolvePublicDomain(url.hostname);
    const result = await probeHttps(url.href);
    return { url, addresses, result };
  }

  const hostGlobal = typeof window !== "undefined" ? window : globalThis;
  hostGlobal.PulseWatchProbe = { parseHttpsUrl, resolvePublicDomain, probeHttps, validateAndProbe };
})();
