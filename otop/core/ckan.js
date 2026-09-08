/**
 * CKAN 2.9 client for data.go.th.
 *
 * Three ways to get rows out of CKAN, tried in order of fidelity:
 *   1. datastore_search  — the resource is loaded into CKAN's DataStore, so we
 *      get typed JSON with real field names and can page cleanly.
 *   2. resource download — the DataStore is not active (very common for older
 *      OTOP releases), so fetch the CSV/XLSX blob and parse it ourselves.
 *   3. give up loudly    — record the reason in the manifest; never pretend.
 *
 * Every failure is captured rather than thrown, because a national ingest that
 * dies on one bad resource out of forty is worse than one that finishes and
 * tells you which four failed.
 */

import { decodeBuffer, csvToObjects } from './text_decode.js';

const DEFAULT_API = 'https://data.go.th/api/3/action';

export class CkanClient {
  constructor({ api = DEFAULT_API, timeoutMs = 60_000, retries = 4, userAgent = 'otop-intelligence/1.0 (+https://otop.nonarkara.org)' } = {}) {
    this.api = api.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
    this.retries = retries;
    this.userAgent = userAgent;
  }

  async #request(url, { accept = 'application/json', raw = false } = {}) {
    let lastError = null;

    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      if (attempt > 0) {
        // 2s, 4s, 8s, 16s — matches the repo's established retry ladder.
        await new Promise((r) => setTimeout(r, 2000 * 2 ** (attempt - 1)));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { accept, 'user-agent': this.userAgent },
        });

        if (response.status === 403 || response.status === 407) {
          // Egress-policy denial. Retrying cannot help and hammering the proxy
          // is antisocial — surface it immediately with the host named.
          throw Object.assign(new Error(`blocked (HTTP ${response.status}) for ${new URL(url).host}`), { blocked: true });
        }
        if (response.status === 404) {
          throw Object.assign(new Error('not found (HTTP 404)'), { fatal: true });
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        return raw
          ? { buffer: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type') ?? '' }
          : await response.json();
      } catch (error) {
        lastError = error;
        if (error.blocked || error.fatal) break;
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError ?? new Error('request failed');
  }

  async action(name, params = {}) {
    const url = new URL(`${this.api}/${name}`);
    for (const [k, v] of Object.entries(params)) {
      if (v != null) url.searchParams.set(k, String(v));
    }
    const body = await this.#request(url.toString());
    if (!body || body.success !== true) {
      throw new Error(`${name}: CKAN returned success=false${body?.error ? ` — ${JSON.stringify(body.error)}` : ''}`);
    }
    return body.result;
  }

  /** Page through package_search until the reported count is exhausted. */
  async searchPackages({ q = '', fq = null, rows = 100, max = 1000 } = {}) {
    const out = [];
    let start = 0;
    let count = Infinity;

    while (out.length < Math.min(max, count)) {
      const result = await this.action('package_search', { q, fq, rows: Math.min(rows, 100), start });
      count = result.count ?? 0;
      const batch = result.results ?? [];
      if (batch.length === 0) break;
      out.push(...batch);
      start += batch.length;
    }

    return { count, packages: out.slice(0, max) };
  }

  /** Page through datastore_search. Returns null when the DataStore is inactive. */
  async datastoreRows(resourceId, { pageSize = 1000, max = 200_000 } = {}) {
    const rows = [];
    let offset = 0;
    let fields = null;

    while (rows.length < max) {
      let page;
      try {
        page = await this.action('datastore_search', { resource_id: resourceId, limit: pageSize, offset });
      } catch (error) {
        if (error.blocked) throw error;
        return offset === 0 ? null : { rows, fields, truncated: true };
      }
      fields ??= (page.fields ?? []).map((f) => f.id).filter((id) => id !== '_id');
      const batch = page.records ?? [];
      if (batch.length === 0) break;
      rows.push(...batch);
      offset += batch.length;
      if (batch.length < pageSize) break;
    }

    return { rows, fields, truncated: rows.length >= max };
  }

  /** Download a resource blob and parse it as delimited text. */
  async downloadRows(resourceUrl) {
    const { buffer, contentType } = await this.#request(resourceUrl, { accept: '*/*', raw: true });
    const { text, encoding, lossy } = decodeBuffer(buffer);

    if (/^\s*[[{]/.test(text)) {
      const parsed = JSON.parse(text);
      const rows = Array.isArray(parsed) ? parsed : parsed.records ?? parsed.result?.records ?? [];
      return { rows, encoding, contentType, format: 'json', bytes: buffer.length };
    }

    const rows = csvToObjects(text);
    return { rows, encoding, contentType, format: 'delimited', bytes: buffer.length, lossy };
  }
}

/** Resources worth trying: tabular formats only. */
export function selectResources(pkg, excludeFormats = []) {
  const excluded = new Set(excludeFormats.map((f) => f.toUpperCase()));
  return (pkg.resources ?? [])
    .filter((r) => {
      const format = String(r.format ?? '').toUpperCase();
      if (excluded.has(format)) return false;
      return ['CSV', 'XLSX', 'XLS', 'JSON', 'API', 'ODS', 'TSV', ''].includes(format);
    })
    .map((r) => ({
      id: r.id,
      name: r.name ?? null,
      format: String(r.format ?? '').toUpperCase() || 'UNKNOWN',
      url: r.url ?? null,
      datastoreActive: Boolean(r.datastore_active),
      lastModified: r.last_modified ?? r.created ?? null,
    }));
}
