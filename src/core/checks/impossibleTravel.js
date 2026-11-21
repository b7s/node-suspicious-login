"use strict";

function inRange(value, limit) { return Number.isFinite(value) && Math.abs(value) <= limit; }
function valid(location) {
  if (!location) return false;
  const { latitude, longitude, accuracyRadiusKm } = location;
  if (!inRange(latitude, 90) || !inRange(longitude, 180)) return false;
  return Number.isFinite(accuracyRadiusKm) && accuracyRadiusKm >= 0;
}
function radians(degrees) { return degrees * Math.PI / 180; }
function distance(a, b) {
  const lat1 = radians(a.latitude), lat2 = radians(b.latitude);
  const deltaLat = lat2 - lat1, deltaLon = radians(b.longitude - a.longitude);
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, h)));
}
function implausible(minimum, hours) {
  return hours > 0 && minimum > 500 && minimum / hours > 900;
}
class ImpossibleTravelCheck {
  run({ current, evidence }) {
    const previous = evidence.lastLocated;
    if (!valid(previous) || !valid(current)) return { pontos: 0, motivo: null };
    const hours = (Date.parse(current.createdAt) - Date.parse(previous.createdAt)) / 3600000;
    const minimum = Math.max(0, distance(previous, current) - previous.accuracyRadiusKm - current.accuracyRadiusKm);
    if (implausible(minimum, hours)) return { pontos: 40, motivo: "impossible_travel" };
    return { pontos: 0, motivo: null };
  }
}
module.exports = ImpossibleTravelCheck;
