"use strict";

const { randomUUID } = require("crypto");
const { realpathSync } = require("fs");
const withLock = require("./lock");
const validatePrune = require("./prune");
const { migrate } = require("./schema");
const SqliteQueries = require("./sqliteQueries");
const BaseStorage = require("./base");

function openDatabase(path) {
  if (process.versions.bun) {
    const { Database } = require("bun:sqlite");
    return new Database(path, { create: true });
  }
  const { DatabaseSync } = require("node:sqlite");
  return new DatabaseSync(path);
}

function decoded(row) {
  if (!row) return null;
  let reasons = row.reasons;
  try { reasons = JSON.parse(reasons); } catch { /* preserve invalid legacy data */ }
  return { ...row, success: Boolean(row.success), blocked: Boolean(row.blocked), reasons };
}

function rowDefaults(data) {
  return { score: data.score ?? 0, level: data.level ?? "low", reasons: JSON.stringify(data.reasons ?? []) };
}
class SqliteStorage extends BaseStorage {
  constructor(dbPath = "suspicious-login.sqlite") {
    super();
    this.db = openDatabase(dbPath);
    this.lockKey = dbPath === ":memory:" ? randomUUID() : realpathSync(dbPath);
    this.db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = DELETE");
    this.prepare = (sql) => this.db.prepare(sql);
    this.queries = new SqliteQueries(this.prepare);
    try { this.migrate(); } catch (error) { this.db.close(); throw error; }
  }
  migrate() { migrate(this.db, this.prepare); }
  withTransaction(callback) {
    return withLock(this.lockKey, () => this.runTransaction(callback));
  }
  async runTransaction(callback) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = await callback(this.queries);
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  async create(data) {
    const row = { first_login: 0, ...data, attempt_id: data.attempt_id || randomUUID(), legacy: 0,
      success: Number(Boolean(data.success)), blocked: Number(Boolean(data.blocked)),
      ...rowDefaults(data),
      created_at: data.created_at || new Date().toISOString() };
    return decoded(await this.withTransaction((tx) => tx.insert(row)));
  }
  readDecision(id) { return withLock(this.lockKey, () => this.queries.decision(id)); }
  listByUser(userId) {
    return this.prepare("SELECT * FROM login_attempts WHERE user_id = ? ORDER BY created_at DESC, id DESC")
      .all(userId).map(decoded);
  }
  prune({ before, limit }) {
    validatePrune({ before, limit });
    return this.withTransaction(() => this.prepare("DELETE FROM login_attempts WHERE id IN (SELECT id FROM login_attempts WHERE created_at < ? ORDER BY created_at, id LIMIT ?)")
      .run(before, limit).changes);
  }
  close() { return withLock(this.lockKey, () => this.db.close()); }
}
module.exports = SqliteStorage;
