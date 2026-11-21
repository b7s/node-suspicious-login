"use strict";

const { randomUUID } = require("crypto");
const BaseStorage = require("./base");
const MemoryQueries = require("./memoryQueries");
const withLock = require("./lock");
const validatePrune = require("./prune");

class MemoryStorage extends BaseStorage {
  constructor() {
    super();
    this._attempts = [];
    this.lockKey = randomUUID();
  }
  migrate() { return undefined; }
  withTransaction(callback) { return withLock(this.lockKey, () => this.runTransaction(callback)); }
  async runTransaction(callback) {
    const snapshot = this._attempts.slice();
    try {
      return await callback(new MemoryQueries(this._attempts));
    } catch (error) {
      this._attempts = snapshot;
      throw error;
    }
  }
  create(data) {
    const row = { ...data, attempt_id: data.attempt_id || randomUUID(), legacy: 0,
      success: Number(Boolean(data.success)), blocked: Number(Boolean(data.blocked)),
      created_at: data.created_at || new Date().toISOString() };
    return this.withTransaction((tx) => tx.insert(row));
  }
  readDecision(id) { return withLock(this.lockKey, () => new MemoryQueries(this._attempts).decision(id)); }
  listByUser(userId) {
    return this._attempts.filter((row) => row.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
      .map((row) => ({ ...row, blocked: Boolean(row.blocked), success: Boolean(row.success) }));
  }
  prune({ before, limit }) {
    validatePrune({ before, limit });
    return withLock(this.lockKey, () => {
      const ids = new Set(this._attempts.filter((row) => row.created_at < before)
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id).slice(0, limit).map((row) => row.id));
      this._attempts = this._attempts.filter((row) => !ids.has(row.id));
      return ids.size;
    });
  }
  close() { return withLock(this.lockKey, () => undefined); }
}
module.exports = MemoryStorage;
