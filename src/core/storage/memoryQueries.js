"use strict";

function recentFailure(row, since, until) {
  return !row.success && !row.legacy && row.created_at >= since && row.created_at <= until;
}
class MemoryQueries {
  constructor(rows) { this.rows = rows; }
  decision(id) { return this.rows.find((row) => row.attempt_id === id); }
  eligible(userId, since) {
    return this.rows.filter((row) => row.user_id === userId && row.created_at >= since && !row.legacy && row.success && !row.blocked);
  }
  hasEligible(userId, since) { return this.eligible(userId, since).length > 0; }
  known(field, userId, value, since) {
    if (!value) return false;
    return this.eligible(userId, since).some((row) => row[field] === value);
  }
  hasObserved(field, userId, since) {
    return this.eligible(userId, since).some((row) => Boolean(row[field]));
  }
  lastLocated(userId, since) {
    return this.eligible(userId, since)
      .filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude) && Number.isFinite(row.accuracy_radius_km))
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)[0];
  }
  failureCount(userId, since, until, limit) {
    return this.rows.filter((row) => row.user_id === userId && !row.success && !row.legacy && row.created_at >= since && row.created_at <= until)
      .slice(0, limit).length;
  }
  matchingIpFailures(ip, since, until) {
    return this.rows.filter((row) => row.ip === ip && row.user_id && recentFailure(row, since, until));
  }
  ipFailures(ip, since, until, limit) { return this.matchingIpFailures(ip, since, until).slice(0, limit).length; }
  ipAccounts(ip, since, until, limit) {
    return Math.min(limit, new Set(this.matchingIpFailures(ip, since, until).map((row) => row.user_id)).size);
  }
  insert(row) {
    if (this.decision(row.attempt_id)) throw new Error("Duplicate attempt ID");
    const record = { id: this.rows.reduce((max, item) => Math.max(max, item.id), 0) + 1, ...row };
    this.rows.push(record);
    return record;
  }
}
module.exports = MemoryQueries;
