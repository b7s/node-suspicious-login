"use strict";

function lastLocation(row) {
  if (!row) return null;
  return { latitude: row.latitude, longitude: row.longitude, accuracyRadiusKm: row.accuracy_radius_km, createdAt: row.created_at };
}
async function accountEvidence(tx, current, since, failureSince, config) {
  if (!current.userId) return { hasEligible: false, accountFailures: 0 };
  return {
    hasEligible: await tx.hasEligible(current.userId, since),
    knownIp: await tx.known("ip", current.userId, current.ip, since),
    knownDevice: await tx.known("device", current.userId, current.deviceId, since),
    knownCountry: await tx.known("country", current.userId, current.country, since),
    hasDeviceHistory: Boolean(current.deviceId) && await tx.hasObserved("device", current.userId, since),
    hasCountryHistory: Boolean(current.country) && await tx.hasObserved("country", current.userId, since),
    lastLocated: lastLocation(await tx.lastLocated(current.userId, since)),
    accountFailures: await tx.failureCount(current.userId, failureSince, current.createdAt, config.failureThreshold),
  };
}
async function ipEvidence(tx, current, since, config) {
  if (!current.ip) return { ipFailures: 0, ipAccounts: 0 };
  const ipFailures = await tx.ipFailures(current.ip, since, current.createdAt, config.ipFailureThreshold);
  const ipAccounts = ipFailures >= config.ipFailureThreshold
    ? await tx.ipAccounts(current.ip, since, current.createdAt, config.ipAccountThreshold) : 0;
  return { ipFailures, ipAccounts };
}
async function evidence(tx, current, config) {
  const now = Date.parse(current.createdAt);
  const since = new Date(now - config.recognitionDays * 86400000).toISOString();
  const failureSince = new Date(now - config.failureWindowMinutes * 60000).toISOString();
  return { ...config, ...await accountEvidence(tx, current, since, failureSince, config),
    ...await ipEvidence(tx, current, failureSince, config) };
}
module.exports = evidence;
