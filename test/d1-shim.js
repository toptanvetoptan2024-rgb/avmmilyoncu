// Testler için Cloudflare D1 ve KV'nin basit taklitleri (better-sqlite3 ile).
import Database from 'better-sqlite3';

const norm = (params) => params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? Number(p) : p));

class Stmt {
  constructor(db, sql, params = []) { this.db = db; this.sql = sql; this.params = params; }
  bind(...params) { return new Stmt(this.db, this.sql, norm(params)); }
  _exec() {
    const s = this.db.prepare(this.sql);
    if (s.reader) return { results: s.all(...this.params), success: true, meta: {} };
    const info = s.run(...this.params);
    return { results: [], success: true, meta: { last_row_id: Number(info.lastInsertRowid), changes: info.changes } };
  }
  async first(col) {
    const row = this.db.prepare(this.sql).get(...this.params);
    if (!row) return null;
    return col ? row[col] : row;
  }
  async all() { return this._exec(); }
  async run() { return this._exec(); }
}

export function createD1() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  return {
    raw: db,
    prepare: (sql) => new Stmt(db, sql),
    batch: async (stmts) => db.transaction(() => stmts.map((s) => s._exec()))(),
    exec: async (sql) => db.exec(sql),
  };
}

