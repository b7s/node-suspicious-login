"use strict";

const evaluate = require("./evaluate");
function fromStored(row) {
  const reasons = typeof row.reasons === "string" ? JSON.parse(row.reasons) : row.reasons;
  return { score: row.score, level: row.level, reasons, blocked: Boolean(row.blocked),
    allowed: Boolean(row.success) && !row.blocked, firstLogin: Boolean(row.first_login), duplicate: true };
}
function record(current, result) {
  return {
    attempt_id: current.attemptId, user_id: current.userId, ip: current.ip, user_agent: current.userAgent,
    country: current.country, device: current.deviceId, latitude: current.latitude, longitude: current.longitude,
    accuracy_radius_km: current.accuracyRadiusKm, success: Number(current.credentialsValid),
    score: result.score, level: result.level, reasons: JSON.stringify(result.reasons),
    blocked: Number(result.blocked), created_at: current.createdAt, legacy: 0, first_login: Number(result.firstLogin),
  };
}
function replay(previous, current) {
  if (!previous) return null;
  if (previous.user_id !== current.userId || Boolean(previous.success) !== current.credentialsValid) {
    throw new Error("Attempt ID belongs to a different authentication result");
  }
  return fromStored(previous);
}
async function execute(tx, current, options) {
  const previous = replay(await tx.decision(current.attemptId), current);
  if (previous) return { result: previous, actionNames: [] };
  const { result, actionNames } = await evaluate(tx, current, options);
  await tx.insert(record(current, result));
  return { result: { ...result, allowed: current.credentialsValid && !result.blocked, duplicate: false }, actionNames };
}
module.exports = { execute, replay };
