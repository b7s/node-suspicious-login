"use strict";

class BaseStorage {
  async migrate() { throw new Error("migrate not implemented"); }
  async withTransaction() { throw new Error("withTransaction not implemented"); }
  async prune() { throw new Error("prune not implemented"); }
  async close() { throw new Error("close not implemented"); }
}
module.exports = BaseStorage;
