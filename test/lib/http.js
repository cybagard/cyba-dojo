'use strict';

/**
 * A tiny cookie-aware HTTP client for the API E2E walkthrough.
 * Persists the session cookie across requests so an authenticated storyline
 * can be walked with one client instance.
 */
const API_PREFIX = '/api/v1';

export function makeClient(base) {
  let cookie = '';

  async function req(path, { method = 'GET', body, headers = {}, form } = {}) {
    const h = { ...headers };
    let payload;
    if (form !== undefined) {
      payload = form; // FormData: let fetch set the multipart boundary
    } else if (body !== undefined) {
      h['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    if (cookie) h.cookie = cookie;

    const res = await fetch(base + path, { method, headers: h, body: payload, redirect: 'manual' });
    const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    if (setCookies.length) {
      cookie = setCookies.map((c) => c.split(';')[0]).join('; ');
    }
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, text, json, headers: res.headers };
  }

  // App API calls are prefixed with /api/v1; rootGet reaches root-level paths
  // (recon endpoints, static /uploads, apidoc).
  return {
    req,
    base,
    get: (p, o) => req(API_PREFIX + p, { ...o, method: 'GET' }),
    post: (p, body, o) => req(API_PREFIX + p, { ...o, method: 'POST', body }),
    patch: (p, body, o) => req(API_PREFIX + p, { ...o, method: 'PATCH', body }),
    rootGet: (p, o) => req(p, { ...o, method: 'GET' }),
    hasCookie: () => Boolean(cookie),
  };
}

/** Build a hand-crafted campus token with an arbitrary header/payload. */
export function craftToken(header, payload, signature = '') {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b(header)}.${b(payload)}.${signature}`;
}
