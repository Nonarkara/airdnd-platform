/**
 * pg_adapter.js — Supabase-compatible interface over pg for migration.
 * Drop-in replacement for createClient: same `.from().select()`, `.from().insert()`,
 * `.from().upsert()` syntax so listing_pipeline.js stays unchanged.
 */

import pg from 'pg';

export function createPgClient(databaseUrl) {
  const pool = new pg.Pool({ connectionString: databaseUrl });

  function from(table) {
    return {
      async select(columns = '*') {
        return {
          eq(col, val) { return this._where(col, '=', val); },
          neq(col, val) { return this._where(col, '!=', val); },
          gt(col, val) { return this._where(col, '>', val); },
          gte(col, val) { return this._where(col, '>=', val); },
          lt(col, val) { return this._where(col, '<', val); },
          lte(col, val) { return this._where(col, '<=', val); },
          in(col, vals) { return this._where(col, 'IN', vals); },
          like(col, pattern) { return this._where(col, 'LIKE', pattern); },
          order(col, opts) { this._orderBy = `${col} ${opts?.ascending ? 'ASC' : 'DESC'}`; return this; },
          limit(n) { this._limit = n; return this; },
          single() { this._single = true; return this; },

          _where(col, op, val) {
            this._filters = this._filters || [];
            this._filters.push({ col, op, val });
            return this;
          },

          then(resolve) {
            (async () => {
              let query = `SELECT ${columns} FROM ${table}`;
              const params = [];
              let i = 1;

              if (this._filters) {
                for (const f of this._filters) {
                  if (f.op === 'IN') {
                    const placeholders = f.val.map(() => `$${i++}`).join(',');
                    query += ` WHERE ${f.col} IN (${placeholders})`;
                    params.push(...f.val);
                  } else if (f.op === 'LIKE') {
                    query += ` WHERE ${f.col} LIKE $${i++}`;
                    params.push(f.val);
                  } else {
                    query += ` WHERE ${f.col} ${f.op} $${i++}`;
                    params.push(f.val);
                  }
                }
              }
              if (this._orderBy) query += ` ORDER BY ${this._orderBy}`;
              if (this._limit) query += ` LIMIT ${this._limit}`;

              const { rows } = await pool.query(query, params);
              const data = this._single ? rows[0] || null : rows;
              resolve({ data, error: null });
            })();
          },
        };
      },

      async insert(rows) {
        const rowArray = Array.isArray(rows) ? rows : [rows];
        if (rowArray.length === 0) return { data: null, error: null };

        const cols = Object.keys(rowArray[0]);
        const colList = cols.join(', ');
        const placeholders = rowArray.map((_, ri) =>
          cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(', '),
        ).join('), (');

        const values = rowArray.flatMap((row) =>
          cols.map((c) => {
            const v = row[c];
            return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
          }),
        );

        try {
          const { rows: inserted } = await pool.query(
            `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) RETURNING *`,
            values,
          );
          return { data: inserted, error: null };
        } catch (err) {
          return { data: null, error: { message: err.message } };
        }
      },

      async upsert(rows, { onConflict } = {}) {
        const rowArray = Array.isArray(rows) ? rows : [rows];
        if (rowArray.length === 0) return { data: null, error: null };

        const cols = Object.keys(rowArray[0]);
        const colList = cols.join(', ');
        const placeholders = rowArray.map((_, ri) =>
          cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(', '),
        ).join('), (');

        const values = rowArray.flatMap((row) =>
          cols.map((c) => {
            const v = row[c];
            return typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
          }),
        );

        // Build ON CONFLICT update for all non-PK columns
        const updateCols = cols.filter((c) => c !== 'id');
        const updateClause = updateCols.map((c) => `${c} = EXCLUDED.${c}`).join(', ');

        try {
          const conflictKey = onConflict || 'id';
          const { rows: inserted } = await pool.query(
            `INSERT INTO ${table} (${colList}) VALUES (${placeholders})
             ON CONFLICT (${conflictKey}) DO UPDATE SET ${updateClause}
             RETURNING *`,
            values,
          );
          return { data: inserted, error: null };
        } catch (err) {
          return { data: null, error: { message: err.message } };
        }
      },

      async update(updates) {
        const entries = Object.entries(updates);
        return {
          eq(col, val) {
            return (async () => {
              const setClauses = entries.map(([k, v], i) => `${k} = $${i + 1}`).join(', ');
              const params = [...entries.map(([, v]) => v), val];
              try {
                await pool.query(`UPDATE ${table} SET ${setClauses} WHERE ${col} = $${entries.length + 1}`, params);
                return { data: null, error: null };
              } catch (err) {
                return { data: null, error: { message: err.message } };
              }
            })();
          },
        };
      },
    };
  }

  return { from, pool };
}