"use strict";

class BaseStorage {
  async create() {
    throw new Error("create not implemented");
  }
  async listByUser() {
    throw new Error("listByUser not implemented");
  }
  async close() {
    return;
  }
}

module.exports = BaseStorage;