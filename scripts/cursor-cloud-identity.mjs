#!/usr/bin/env node

// Read the current Cursor Cloud Agent identity from the local Unix socket and
// mint one short-lived OIDC token bound to the myagent binding nonce.
//
// Output (stdout) is exactly { cloud_agent_id, oidc_token }. The token is
// never printed anywhere else; diagnostics and usage examples must not echo
// it.

import net from "node:net";

const args = process.argv.slice(2);
const nonceIndex = args.indexOf("--nonce");
const nonce = nonceIndex >= 0 ? args[nonceIndex + 1] : "";
if (!nonce) {
  console.error("Usage: cursor-cloud-identity.mjs --nonce <myagent-nonce>");
  process.exit(2);
}

const socketPath = process.env.CURSOR_AGENT_SOCKET || "/run/cursor/api.sock";
const audience = process.env.MYAGENT_OIDC_AUDIENCE || "https://myagent.to";

// The agent socket may appear shortly after boot. Retry a missing socket for
// a short bounded window; invalid responses fail immediately and are never
// retried.
const SOCKET_RETRIES = 5;
const SOCKET_RETRY_MS = 1000;

function requestRaw(path, method, body) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    const payload = body ? JSON.stringify(body) : "";
    let response = "";
    socket.setTimeout(5000);
    socket.on("connect", () => {
      socket.write(`${method} ${path} HTTP/1.1\r\nHost: cursor-agent\r\nConnection: close\r\nAccept: application/json\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`);
    });
    socket.on("data", (chunk) => { response += chunk.toString(); });
    socket.on("timeout", () => { socket.destroy(new Error("Cursor agent socket timed out")); });
    socket.on("error", reject);
    socket.on("close", () => {
      const separator = response.indexOf("\r\n\r\n");
      if (separator < 0) return reject(new Error("Invalid Cursor agent response"));
      const head = response.slice(0, separator);
      const bodyText = response.slice(separator + 4);
      const status = Number(/^HTTP\/\d\.\d\s+(\d+)/.exec(head)?.[1] || 0);
      if (status < 200 || status >= 300) return reject(new Error(`Cursor agent returned HTTP ${status}`));
      resolve(bodyText);
    });
  });
}

async function requestWithSocketRetry(path, method, body) {
  let lastError;
  for (let attempt = 0; attempt <= SOCKET_RETRIES; attempt += 1) {
    try {
      return await requestRaw(path, method, body);
    } catch (error) {
      lastError = error;
      const missing = error.code === "ENOENT" || /ENOENT/.test(String(error.message));
      if (!missing || attempt === SOCKET_RETRIES) throw error;
      await new Promise((resolve) => setTimeout(resolve, SOCKET_RETRY_MS));
    }
  }
  throw lastError;
}

try {
  // GET /v1/meta-data/agent/id returns text/plain: the durable bc-... id.
  const metadataText = (await requestWithSocketRetry("/v1/meta-data/agent/id", "GET")).trim();
  if (!/^bc-[A-Za-z0-9_-]+$/.test(metadataText)) throw new Error("Cursor agent metadata did not return a Cloud Agent id");
  // POST /v1/tokens/oidc takes { aud, nonce } and returns JSON with token.
  const tokenText = await requestWithSocketRetry("/v1/tokens/oidc", "POST", { aud: audience, nonce });
  let tokenResponse;
  try {
    tokenResponse = JSON.parse(tokenText);
  } catch {
    throw new Error("Cursor OIDC endpoint did not return JSON");
  }
  if (typeof tokenResponse.token !== "string" || !tokenResponse.token) throw new Error("Cursor OIDC endpoint did not return a token");
  process.stdout.write(JSON.stringify({ cloud_agent_id: metadataText, oidc_token: tokenResponse.token }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
