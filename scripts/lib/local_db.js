// Local data station for AirDnD — replaces Supabase (org restricted 2026-10-18).
//
// createDataClient() returns an object with the slice of the supabase-js API the
// scripts use, backed by the M3's Postgres (`airdnd`) and a local photo folder:
//
//   db.from(t).select(cols).eq().neq().in().lt().lte().gt().gte().is()
//     .order(col, { ascending, nullsFirst }).limit(n).range(a, b)   -> { data, error }
//   db.from(t).insert(rows) / .update(payload).eq(...) / .delete().eq(...)
//   db.from(t).upsert(rows, { onConflict, ignoreDuplicates })
//   db.storage.from(bucket).upload(key, buffer) / .getPublicUrl(key)
//
// Env:
//   DATABASE_URL   default postgresql://localhost:5432/airdnd
//   PHOTO_ROOT     default /Volumes/Data/AirDnD/photos   (files land in <root>/<bucket>/<key>)
//   MEDIA_BASE_URL default https://airdnd-media.pages.dev/
import fs from 'fs';
import path from 'path';
import pg from 'pg';

export const DEFAULT_DATABASE_URL = 'postgresql://localhost:5432/airdnd';
export const PHOTO_ROOT = process.env.PHOTO_ROOT || '/Volumes/Data/AirDnD/photos';
export const MEDIA_BASE_URL = (process.env.MEDIA_BASE_URL || 'https://airdnd-media.pages.dev/').replace(/\/?$/, '/');

// Match supabase-js/PostgREST JSON shapes: numbers for bigint/numeric, ISO
// strings for timestamps (pg would otherwise give strings and Date objects).
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString());
pg.types.setTypeParser(1114, (v) => v.replace(' ', 'T'));

const IDENT = /^[a-z_][a-z0-9_]*$/i;
function ident(name) {
  const trimmed = String(name).trim();
  if (!IDENT.test(trimmed)) throw new Error(`Unsafe identifier: ${name}`);
  return `"${trimmed}"`;
}

function err(error) {
  return error ? { message: error.message || String(error), code: error.code || null } : null;
}

class Query {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.mode = 'select';
    this.columns = '*';
    this.where = [];
    this.params = [];
    this.orders = [];
    this.limitN = null;
    this.offsetN = null;
    this.payload = null;
    this.options = {};
    this.returning = false;
  }

  select(columns = '*') {
    if (this.mode === 'select') this.columns = columns;
    else this.returning = true;
    return this;
  }
  insert(rows) { this.mode = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  upsert(rows, options = {}) { this.mode = 'upsert'; this.payload = Array.isArray(rows) ? rows : [rows]; this.options = options; return this; }
  update(payload) { this.mode = 'update'; this.payload = payload; return this; }
  delete() { this.mode = 'delete'; return this; }

  _cond(column, op, value) {
    this.params.push(value);
    this.where.push(`${ident(column)} ${op} $${this.params.length}`);
    return this;
  }
  eq(c, v) { return v === null ? this.is(c, null) : this._cond(c, '=', v); }
  neq(c, v) { return this._cond(c, '<>', v); }
  lt(c, v) { return this._cond(c, '<', v); }
  lte(c, v) { return this._cond(c, '<=', v); }
  gt(c, v) { return this._cond(c, '>', v); }
  gte(c, v) { return this._cond(c, '>=', v); }
  in(c, values) {
    this.params.push(Array.isArray(values) ? values : [values]);
    this.where.push(`${ident(c)} = ANY($${this.params.length})`);
    return this;
  }
  is(c, v) { this.where.push(`${ident(c)} IS ${v === null ? 'NULL' : v ? 'TRUE' : 'FALSE'}`); return this; }
  order(column, { ascending = true, nullsFirst } = {}) {
    const nulls = nullsFirst === undefined ? '' : nullsFirst ? ' NULLS FIRST' : ' NULLS LAST';
    this.orders.push(`${ident(column)} ${ascending ? 'ASC' : 'DESC'}${nulls}`);
    return this;
  }
  limit(n) { this.limitN = Math.max(0, Math.floor(n)); return this; }
  range(from, to) { this.offsetN = from; this.limitN = to - from + 1; return this; }
  abortSignal() { return this; }
  single() { this.singleRow = true; this.limitN = 1; return this; }
  maybeSingle() { return this.single(); }

  async _types() {
    return this.client.columnTypes(this.table);
  }

  _encode(types, column, value) {
    if (value === undefined) return null;
    const type = types.get(column);
    if ((type === 'jsonb' || type === 'json') && value !== null) return JSON.stringify(value);
    return value;
  }

  _whereSql(offset = 0) {
    if (!this.where.length) return '';
    return ` WHERE ${this.where.map((w) => w.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + offset}`)).join(' AND ')}`;
  }

  async _run() {
    const t = ident(this.table);
    if (this.mode === 'select') {
      const cols = this.columns.trim() === '*' ? '*' : this.columns.split(',').map(ident).join(', ');
      let sql = `SELECT ${cols} FROM ${t}${this._whereSql()}`;
      if (this.orders.length) sql += ` ORDER BY ${this.orders.join(', ')}`;
      if (this.limitN !== null) sql += ` LIMIT ${this.limitN}`;
      if (this.offsetN !== null) sql += ` OFFSET ${Math.max(0, Math.floor(this.offsetN))}`;
      const { rows } = await this.client.pool.query(sql, this.params);
      return this.singleRow ? rows[0] || null : rows;
    }

    const types = await this._types();
    if (this.mode === 'insert' || this.mode === 'upsert') {
      if (!this.payload.length) return [];
      const columns = [...new Set(this.payload.flatMap((row) => Object.keys(row)))];
      const unknown = columns.filter((c) => !types.has(c));
      if (unknown.length) {
        const e = new Error(`column "${unknown[0]}" of relation "${this.table}" does not exist`);
        e.code = '42703';
        throw e;
      }
      const params = [];
      const values = this.payload.map((row) => `(${columns.map((c) => {
        params.push(this._encode(types, c, row[c]));
        return `$${params.length}`;
      }).join(', ')})`);
      let sql = `INSERT INTO ${t} (${columns.map(ident).join(', ')}) VALUES ${values.join(', ')}`;
      if (this.mode === 'upsert') {
        const conflict = (this.options.onConflict || 'id').split(',').map(ident).join(', ');
        const updatable = columns.filter((c) => !(this.options.onConflict || 'id').split(',').map((s) => s.trim()).includes(c));
        sql += this.options.ignoreDuplicates || !updatable.length
          ? ` ON CONFLICT (${conflict}) DO NOTHING`
          : ` ON CONFLICT (${conflict}) DO UPDATE SET ${updatable.map((c) => `${ident(c)} = EXCLUDED.${ident(c)}`).join(', ')}`;
      }
      sql += ' RETURNING *';
      const { rows } = await this.client.pool.query(sql, params);
      return rows;
    }

    if (this.mode === 'update') {
      const columns = Object.keys(this.payload).filter((c) => this.payload[c] !== undefined);
      const unknown = columns.filter((c) => !types.has(c));
      if (unknown.length) {
        const e = new Error(`column "${unknown[0]}" of relation "${this.table}" does not exist`);
        e.code = '42703';
        throw e;
      }
      const params = columns.map((c) => this._encode(types, c, this.payload[c]));
      const sets = columns.map((c, i) => `${ident(c)} = $${i + 1}`).join(', ');
      const sql = `UPDATE ${t} SET ${sets}${this._whereSql(params.length)} RETURNING *`;
      const { rows } = await this.client.pool.query(sql, [...params, ...this.params]);
      return rows;
    }

    if (this.mode === 'delete') {
      if (!this.where.length) throw new Error('Refusing DELETE without a filter');
      const { rows } = await this.client.pool.query(`DELETE FROM ${t}${this._whereSql()} RETURNING *`, this.params);
      return rows;
    }
    throw new Error(`Unsupported mode ${this.mode}`);
  }

  then(onFulfilled, onRejected) {
    return this._run()
      .then((data) => ({ data, error: null }), (error) => ({ data: null, error: err(error) }))
      .then(onFulfilled, onRejected);
  }
  catch(onRejected) { return this.then(undefined, onRejected); }
}

class LocalStorageBucket {
  constructor(bucket) { this.bucket = bucket; }
  _path(key) {
    const full = path.resolve(PHOTO_ROOT, this.bucket, key);
    if (!full.startsWith(path.resolve(PHOTO_ROOT) + path.sep)) throw new Error(`Unsafe storage key: ${key}`);
    return full;
  }
  async upload(key, buffer, { upsert = false } = {}) {
    try {
      const file = this._path(key);
      if (fs.existsSync(file) && !upsert) return { data: { path: key }, error: { message: 'The resource already exists' } };
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buffer);
      return { data: { path: key }, error: null };
    } catch (error) {
      return { data: null, error: err(error) };
    }
  }
  getPublicUrl(key) {
    return { data: { publicUrl: `${MEDIA_BASE_URL}${this.bucket}/${key}` } };
  }
}

class LocalDataClient {
  constructor(connectionString) {
    this.pool = new pg.Pool({ connectionString, max: 4, idleTimeoutMillis: 10_000 });
    this.pool.on('error', (e) => console.warn(`[local_db] pool error: ${e.message}`));
    this.types = new Map();
    this.storage = {
      from: (bucket) => new LocalStorageBucket(bucket),
      listBuckets: async () => ({ data: [{ name: 'listing-photos' }], error: null }),
      createBucket: async () => ({ data: null, error: null }),
    };
  }
  from(table) { return new Query(this, table); }
  async columnTypes(table) {
    if (!this.types.has(table)) {
      const { rows } = await this.pool.query(
        'SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2',
        ['public', table],
      );
      this.types.set(table, new Map(rows.map((r) => [r.column_name, r.data_type])));
    }
    return this.types.get(table);
  }
  async end() { await this.pool.end(); }
}

let shared = null;
export function createDataClient(connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL) {
  if (!shared) shared = new LocalDataClient(connectionString);
  return shared;
}
export async function closeDataClient() {
  if (shared) { const c = shared; shared = null; await c.end(); }
}
