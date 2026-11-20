"use strict";

const initSqlJs = require("sql.js");
const BaseStorage = require("./base");
const fs = require("fs");

class SqliteStorage extends BaseStorage {
  constructor(dbPath) {
    super();
    this.dbPath = dbPath;
    this.db = null;
    this._initialized = this._init();
  }

  async _init() {
    const SQL = await initSqlJs();
    this.SQL = SQL;
    let existingData = null;
    try {
      existingData = fs.readFileSync(this.dbPath);
    } catch { /* ignore */ }
    this.db = new this.SQL.Database(existingData);
    this._migrate();
    this._persist();
  }

  _migrate() {
    this.db.run(`CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, ip TEXT NOT NULL,
      user_agent TEXT, country TEXT, device TEXT, success INTEGER NOT NULL DEFAULT 0,
      score INTEGER NOT NULL DEFAULT 0, reasons TEXT, blocked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`);
    this.db.run("CREATE INDEX IF NOT EXISTS idx_user ON login_attempts(user_id)");
    this.db.run("CREATE INDEX IF NOT EXISTS idx_created ON login_attempts(created_at)");
    this._persist();
  }

  _persist() {
    try {
      fs.writeFileSync(this.dbPath, new Uint8Array(this.db.export()));
    } catch { /* ignore */ }
  }

  async create(data) {
    await this._ready();
    const row = this._insertAttempt(data);
    this._persist();
    return this._rowToObject(row);
  }

  _insertAttempt(data) {
    const params = this._buildParams(data);
    this.db.run(this._insertSql(), params);
    return this.db.prepare("SELECT * FROM login_attempts WHERE id = (SELECT MAX(id) FROM login_attempts)").get();
  }

  _buildParams(data) {
    return [
      data.user_id, data.ip, data.user_agent || null, data.country || null,
      data.device, this._flag(data.success), data.score || 0,
      JSON.stringify(data.reasons || []), this._flag(data.blocked), data.created_at,
    ];
  }

  _flag(value) {
    return value ? 1 : 0;
  }

  _insertSql() {
    return `INSERT INTO login_attempts (user_id, ip, user_agent, country, device, success, score, reasons, blocked, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  }

  async listByUser(userId) {
    await this._ready();
    const rows = this.db.prepare("SELECT * FROM login_attempts WHERE user_id = ? ORDER BY created_at DESC").all(userId);
    return rows.map((r) => this._rowToObject(r));
  }

  async close() {
    if (this.db) {
      this._persist();
      this.db.close();
    }
  }

  _rowToObject(row) {
    if (!row) return null;
    return {
      id: row.id, user_id: row.user_id, ip: row.ip, user_agent: row.user_agent,
      country: row.country, device: row.device, success: !!row.success, score: row.score,
      reasons: row.reasons ? JSON.parse(row.reasons) : [], blocked: !!row.blocked,
      created_at: row.created_at,
    };
  }
}

module.exports = SqliteStorage;