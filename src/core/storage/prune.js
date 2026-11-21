"use strict";
function validateTimestamp(before) {
  if (typeof before !== "string" || !Number.isFinite(Date.parse(before))) throw new TypeError("A valid before timestamp is required");
  if (new Date(before).toISOString() !== before) throw new TypeError("before must be a UTC ISO timestamp");
}
function validatePrune({ before, limit }) {
  validateTimestamp(before);
  if (!Number.isInteger(limit) || limit <= 0) throw new TypeError("A positive batch limit is required");
}
module.exports = validatePrune;
