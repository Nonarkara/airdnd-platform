/**
 * Minimal Cloudflare R2 client over its S3-compatible API: HEAD, PUT and
 * DELETE, signed with AWS Signature V4 (aws4). Three verbs are all publishing
 * needs, and they do not justify the full AWS SDK.
 *
 * Endpoint: https://<account id>.r2.cloudflarestorage.com, path-style, region
 * "auto". Credentials come from an R2 API token (Access Key ID + Secret).
 */

import http from 'node:http';
import https from 'node:https';
import aws4 from 'aws4';

function request(transport, options, body) {
  return new Promise((resolve, reject) => {
    const req = transport.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.setTimeout(60_000, () => req.destroy(new Error('R2 request timed out')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

export function createR2Client({ accountId, accessKeyId, secretAccessKey, bucket, endpoint } = {}) {
  if (!bucket || !accessKeyId || !secretAccessKey || !(endpoint || accountId)) {
    throw new Error('R2 needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET');
  }
  const base = new URL(endpoint || `https://${accountId}.r2.cloudflarestorage.com`);
  const transport = base.protocol === 'http:' ? http : https;
  const credentials = { accessKeyId, secretAccessKey };

  const signed = (method, key, { body, headers = {} } = {}) => {
    const path = `/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;
    const opts = aws4.sign({
      host: base.host, path, method, service: 's3', region: 'auto', headers, body,
    }, credentials);
    return { ...opts, protocol: base.protocol, hostname: base.hostname, port: base.port || undefined };
  };

  return {
    async exists(key) {
      const res = await request(transport, signed('HEAD', key));
      if (res.status === 200) return true;
      if (res.status === 404) return false;
      throw new Error(`R2 HEAD ${key}: HTTP ${res.status}`);
    },
    async put(key, body, { contentType = 'application/octet-stream', cacheControl } = {}) {
      const headers = { 'Content-Type': contentType, 'Content-Length': body.length };
      if (cacheControl) headers['Cache-Control'] = cacheControl;
      const res = await request(transport, signed('PUT', key, { body, headers }), body);
      if (res.status !== 200) throw new Error(`R2 PUT ${key}: HTTP ${res.status} ${res.body.slice(0, 200)}`);
      return true;
    },
    async remove(key) {
      const res = await request(transport, signed('DELETE', key));
      if (res.status === 204 || res.status === 200 || res.status === 404) return true;
      throw new Error(`R2 DELETE ${key}: HTTP ${res.status} ${res.body.slice(0, 200)}`);
    },
  };
}
