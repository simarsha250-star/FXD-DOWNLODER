// Client for the two serverless endpoints. Every failure becomes a plain { ok:false } result.

async function getJson(path, { signal, fetchImpl = globalThis.fetch } = {}) {
  let res;
  try {
    res = await fetchImpl(path, { signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    return { ok: false, code: 'service_unavailable', message: 'The preview service could not be reached.' };
  }
  try {
    const data = await res.json();
    if (data && typeof data === 'object') return data;
  } catch {
    /* Not JSON: static hosting without functions answers with an HTML 404 page. */
  }
  return { ok: false, code: 'service_unavailable', message: 'The preview service is not available here.' };
}

export const fetchPreview = (url, options) => getJson(`/api/oembed?url=${encodeURIComponent(url)}`, options);

/** Returns the status object, or null when the functions are not deployed or not reachable. */
export async function fetchStatus(options) {
  const data = await getJson('/api/status', options);
  return data && data.ok ? data : null;
}
