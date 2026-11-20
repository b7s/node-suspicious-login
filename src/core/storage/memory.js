"use strict";

const BaseStorage = require("./base");

class MemoryStorage extends BaseStorage {
  constructor() {
    super();
    this._attempts = [];
  }

  async create(data) {
    const record = {
      id: this._attempts.length + 1,
      user_id: data.user_id,
      ip: data.ip,
      user_agent: data.user_agent,
      country: data.country,
      device: data.device,
      success: !!data.success,
      score: data.score || 0,
      reasons: data.reasons || [],
      blocked: !!data.blocked,
      created_at: data.created_at || new Date().toISOString(),
    };
    this._attempts.push(record);
    return record;
  }

  async listByUser(userId) {
    return this._attempts
      .filter((a) => a.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async close() {
    return;
  }
}

module.exports = MemoryStorage;