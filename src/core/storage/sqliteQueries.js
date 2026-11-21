"use strict";

const { KNOWN_FAILURE, COUNT_IP_ACCOUNTS } = require("./failureAccounts");

const ELIGIBLE = "user_id = ? AND created_at >= ? AND legacy = 0 AND success = 1 AND blocked = 0";
const COLUMNS = ["attempt_id", "user_id", "ip", "user_agent", "country", "device", "latitude", "longitude",
  "accuracy_radius_km", "success", "score", "level", "reasons", "blocked", "created_at", "legacy", "first_login"];

class SqliteQueries {
  constructor(prepare) { this.prepare = prepare; }
  decision(id) {
    return this.prepare("SELECT * FROM login_attempts WHERE attempt_id = ?").get(id);
  }
  hasEligible(userId, since) {
    return Boolean(this.prepare(`SELECT 1 AS found FROM login_attempts WHERE ${ELIGIBLE} LIMIT 1`).get(userId, since));
  }
  known(field, userId, value, since) {
    if (!["ip", "device", "country"].includes(field)) throw new TypeError("Invalid signal");
    if (!value) return false;
    return Boolean(this.prepare(`SELECT 1 AS found FROM login_attempts WHERE ${ELIGIBLE} AND ${field} = ? LIMIT 1`)
      .get(userId, since, value));
  }
  hasObserved(field, userId, since) {
    if (!["device", "country"].includes(field)) throw new TypeError("Invalid optional signal");
    return Boolean(this.prepare(`SELECT 1 FROM login_attempts WHERE ${ELIGIBLE} AND ${field} <> '' LIMIT 1`)
      .get(userId, since));
  }
  lastLocated(userId, since) {
    return this.prepare(`SELECT * FROM login_attempts WHERE ${ELIGIBLE}
      AND latitude IS NOT NULL AND longitude IS NOT NULL AND accuracy_radius_km IS NOT NULL
      ORDER BY created_at DESC, id DESC LIMIT 1`).get(userId, since);
  }
  failureCount(userId, since, until, limit) {
    return this.prepare(`SELECT count(*) AS n FROM (SELECT 1 FROM login_attempts
      WHERE user_id = ? AND success = 0 AND legacy = 0 AND created_at >= ? AND created_at <= ? LIMIT ?)`)
      .get(userId, since, until, limit).n;
  }
  ipFailures(ip, since, until, limit) {
    return this.prepare(`SELECT count(*) AS n FROM (SELECT 1 FROM login_attempts
      WHERE ${KNOWN_FAILURE} AND ip = ? AND created_at BETWEEN ? AND ? LIMIT ?)`).get(ip, since, until, limit).n;
  }
  ipAccounts(ip, since, until, limit) {
    return this.prepare(COUNT_IP_ACCOUNTS).get(ip, since, until, since, until, limit).n;
  }
  insert(row) {
    const values = COLUMNS.map((key) => row[key] ?? null);
    const placeholders = COLUMNS.map(() => "?").join(",");
    this.prepare(`INSERT INTO login_attempts (${COLUMNS.join(",")}) VALUES (${placeholders})`).run(...values);
    return this.decision(row.attempt_id);
  }
}
module.exports = SqliteQueries;
