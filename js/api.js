/**
 * Thin fetch wrapper. Every call inherits the base URL + Authorization header
 * from the auth module. JSON in, JSON out.
 */

import { getSession, clearSession } from "./auth.js";

class ApiError extends Error {
  constructor(status, payload) {
    super(typeof payload === "string" ? payload : JSON.stringify(payload));
    this.status = status;
    this.payload = payload;
  }
}

async function request(method, path, body) {
  const session = getSession();
  if (!session) throw new ApiError(401, "Not authenticated.");

  const url = session.baseUrl + path;
  const headers = { "Content-Type": "application/json" };
  if (session.access) headers["Authorization"] = `Bearer ${session.access}`;

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return null;

  const text = await response.text();
  const payload = text ? safeJson(text) : null;

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired or invalid → drop the session and let the router send
      // the user back to the login screen.
      clearSession();
    }
    throw new ApiError(response.status, payload ?? text);
  }
  return payload;
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return text; }
}

export const api = {
  get: (p) => request("GET", p),
  post: (p, b) => request("POST", p, b),
  patch: (p, b) => request("PATCH", p, b),
  put: (p, b) => request("PUT", p, b),
  delete: (p) => request("DELETE", p),
};

export { ApiError };

/** Login goes through fetch directly because we don't have a token yet
 *  and we need to talk to a host the session module hasn't recorded. */
export async function loginRequest(baseUrl, username, password) {
  const response = await fetch(baseUrl + "/api/auth/login/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const text = await response.text();
  const payload = text ? safeJson(text) : null;
  if (!response.ok) throw new ApiError(response.status, payload ?? text);
  return payload;
}

/** Decode the JWT body (no signature check — just to read role/schema). */
export function decodeJwt(token) {
  const part = token.split(".")[1];
  if (!part) return {};
  const padded = part + "=".repeat((4 - (part.length % 4)) % 4);
  const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(decodeURIComponent(escape(json)));
}