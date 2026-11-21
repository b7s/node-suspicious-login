"use strict";

function validateIdentity(input) {
  if (typeof input.credentialsValid !== "boolean") throw new TypeError("credentialsValid must be a boolean");
  if (input.credentialsValid && !input.userId) throw new TypeError("Authenticated userId is required");
}
function validateUserId(userId) {
  if (userId != null && typeof userId !== "string") throw new TypeError("Invalid userId");
}
function validate(input) {
  if (!input || typeof input.attemptId !== "string" || !input.attemptId) throw new TypeError("attemptId is required");
  validateIdentity(input);
  validateUserId(input.userId);
}
function validLatitude(value) { return Number.isFinite(value) && Math.abs(value) <= 90; }
function validLongitude(value) { return Number.isFinite(value) && Math.abs(value) <= 180; }
function coordinates(location) {
  const { latitude, longitude, accuracyRadiusKm } = location;
  if (!validLatitude(latitude) || !validLongitude(longitude)) return {};
  if (!Number.isFinite(accuracyRadiusKm) || accuracyRadiusKm < 0) return {};
  return { latitude, longitude, accuracyRadiusKm };
}
function countryCode(location) {
  if (typeof location.country !== "string") return null;
  return /^[A-Z]{2}$/.test(location.country) ? location.country : null;
}
function optionalFields(input) {
  return { ip: input.ip ?? null, userAgent: input.userAgent ?? null, deviceId: input.deviceId ?? null, email: input.email ?? null };
}
function attempt(input) {
  validate(input);
  return { attemptId: input.attemptId, userId: input.userId ?? null, credentialsValid: input.credentialsValid,
    ...optionalFields(input), country: null, createdAt: new Date().toISOString() };
}
function withLocation(current, location) {
  return { ...current, country: countryCode(location), ...coordinates(location), createdAt: new Date().toISOString() };
}
module.exports = { attempt, withLocation };
