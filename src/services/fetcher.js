'use strict';

/**
 * Fetch a remote resource on behalf of a user (used by the profile avatar
 * import and the timetable importer).
 *
 * The destination URL is taken from user input and requested directly.
 */
export async function fetchUrl(target, { asText = true } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(target, {
      signal: controller.signal,
      redirect: 'follow',
    });
    const contentType = res.headers.get('content-type') || '';
    const body = asText ? await res.text() : await res.arrayBuffer();
    return {
      ok: res.ok,
      status: res.status,
      contentType,
      body,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Consume a third-party timetable feed and merge whatever it returns straight
 * into the response, trusting the upstream payload as-is.
 */
export async function importTimetable(feedUrl) {
  const res = await fetchUrl(feedUrl, { asText: true });
  let parsed;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    parsed = { raw: res.body };
  }
  return parsed;
}
