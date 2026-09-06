// A tiny Supabase-compatible query builder backed by the local SQLite store.
//
// It implements only the surface the ingestion pipeline actually uses:
//   supabase.from(t).select(cols).eq(col, val).limit(n)      -> { data, error }
//   supabase.from(t).insert([row])                           -> { data, error }
//   supabase.from(t).update(payload).eq('id', id)            -> { data, error }
//   supabase.from(t).upsert(rows, { onConflict, ignoreDuplicates })
//
// This means scripts/listing_pipeline.js (insertListingsIfPossible,
// archiveChannelMessages) and the photo-archive writer keep working unchanged
// against a local database instead of Supabase.

import { JSON_COLUMNS, tableColumns } from './local_store.js';

function toStorageValue(table, column, value) {
  if (value === undefined) {
    return null;
  }
  if ((JSON_COLUMNS[table] || []).includes(column)) {
    return value === null ? null : JSON.stringify(value);
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return value;
}

function fromStorageRow(table, row) {
  if (!row) {
    return row;
  }
  const plain = { ...row };
  for (const column of JSON_COLUMNS[table] || []) {
    if (typeof plain[column] === 'string') {
      try {
        plain[column] = JSON.parse(plain[column]);
      } catch {
        plain[column] = null;
      }
    }
  }
  return plain;
}

function normalizeError(error) {
  if (!error) {
    return null;
  }
  return { message: error.message || String(error), code: error.code || null };
}

// Returns an awaitable object that runs `executor` (which yields { data, error })
// when the caller `await`s it — mirroring the supabase-js PostgrestBuilder.
function makeThenable(executor) {
  return {
    then(onFulfilled, onRejected) {
      let result;
      try {
        result = executor();
      } catch (error) {
        result = { data: null, error: normalizeError(error) };
      }
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
    catch(onRejected) {
      return this.then(undefined, onRejected);
    },
  };
}

class FilterQuery {
  constructor(ctx, table, mode, payload) {
    this.ctx = ctx;
    this.table = table;
    this.mode = mode; // 'select' | 'update'
    this.payload = payload;
    this.filters = [];
    this.orders = [];
    this.limitN = null;
  }

  eq(column, value) {
    this.filters.push([column, value]);
    return this;
  }

  order(column, options = {}) {
    this.orders.push({ column, ascending: options.ascending !== false });
    return this;
  }

  limit(n) {
    this.limitN = n;
    return this;
  }

  _whereClause() {
    if (this.filters.length === 0) {
      return { sql: '', params: [] };
    }
    const sql = ` WHERE ${this.filters.map(([col]) => `${col} = ?`).join(' AND ')}`;
    const params = this.filters.map(([, val]) => (val === undefined ? null : val));
    return { sql, params };
  }

  _runSelect() {
    const { sql: whereSql, params } = this._whereClause();
    let sql = `SELECT * FROM ${this.table}${whereSql}`;
    if (this.orders.length > 0) {
      sql += ` ORDER BY ${this.orders.map((o) => `${o.column} ${o.ascending ? 'ASC' : 'DESC'}`).join(', ')}`;
    }
    if (Number.isFinite(this.limitN)) {
      sql += ` LIMIT ${Math.max(0, Math.floor(this.limitN))}`;
    }
    const rows = this.ctx.db.prepare(sql).all(...params).map((row) => fromStorageRow(this.table, row));
    return { data: rows, error: null };
  }

  _runUpdate() {
    const columns = this.ctx.columns(this.table);
    const entries = Object.entries(this.payload).filter(([col]) => columns.includes(col));
    if (entries.length === 0) {
      return { data: null, error: null };
    }
    const { sql: whereSql, params: whereParams } = this._whereClause();
    const setSql = entries.map(([col]) => `${col} = ?`).join(', ');
    const setParams = entries.map(([col, val]) => toStorageValue(this.table, col, val));
    const sql = `UPDATE ${this.table} SET ${setSql}${whereSql}`;
    this.ctx.db.prepare(sql).run(...setParams, ...whereParams);
    return { data: null, error: null };
  }

  _run() {
    return this.mode === 'update' ? this._runUpdate() : this._runSelect();
  }

  then(onFulfilled, onRejected) {
    return makeThenable(() => this._run()).then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this.then(undefined, onRejected);
  }
}

class TableQuery {
  constructor(ctx, table) {
    this.ctx = ctx;
    this.table = table;
  }

  select(_cols = '*') {
    return new FilterQuery(this.ctx, this.table, 'select');
  }

  update(payload) {
    return new FilterQuery(this.ctx, this.table, 'update', payload || {});
  }

  insert(rows) {
    return makeThenable(() => this._insertRows(Array.isArray(rows) ? rows : [rows]));
  }

  upsert(rows, options = {}) {
    return makeThenable(() =>
      this._insertRows(Array.isArray(rows) ? rows : [rows], {
        conflict: options.onConflict,
        ignoreDuplicates: options.ignoreDuplicates,
      }),
    );
  }

  _insertRows(rows, conflictOptions = null) {
    const columns = this.ctx.columns(this.table);
    for (const row of rows) {
      const entries = Object.entries(row || {}).filter(([col]) => columns.includes(col));
      if (entries.length === 0) {
        continue;
      }
      const cols = entries.map(([col]) => col);
      const placeholders = cols.map(() => '?').join(', ');
      const params = entries.map(([col, val]) => toStorageValue(this.table, col, val));

      let sql = `INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${placeholders})`;
      if (conflictOptions?.conflict) {
        const conflictCols = conflictOptions.conflict.split(',').map((c) => c.trim()).join(', ');
        if (conflictOptions.ignoreDuplicates) {
          sql += ` ON CONFLICT (${conflictCols}) DO NOTHING`;
        } else {
          const updates = cols
            .filter((col) => !conflictOptions.conflict.split(',').map((c) => c.trim()).includes(col))
            .map((col) => `${col} = excluded.${col}`)
            .join(', ');
          sql += updates
            ? ` ON CONFLICT (${conflictCols}) DO UPDATE SET ${updates}`
            : ` ON CONFLICT (${conflictCols}) DO NOTHING`;
        }
      }
      this.ctx.db.prepare(sql).run(...params);
    }
    return { data: null, error: null };
  }
}

/**
 * Build a Supabase-compatible client backed by a local SQLite database handle.
 *
 * @param {import('node:sqlite').DatabaseSync} db an open handle from openLocalDb()
 * @returns {{ from: (table: string) => TableQuery, __isLocalShim: boolean }}
 */
export function createLocalSupabaseShim(db) {
  const columnCache = new Map();
  const ctx = {
    db,
    columns(table) {
      if (!columnCache.has(table)) {
        columnCache.set(table, tableColumns(db, table));
      }
      return columnCache.get(table);
    },
  };

  return {
    __isLocalShim: true,
    from(table) {
      return new TableQuery(ctx, table);
    },
  };
}
