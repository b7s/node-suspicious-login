"use strict";

const DefaultPreset = require("./presets/defaultPreset");
const checks = ["newDevice", "newIp", "newCountry", "impossibleTravel", "repeatedFailures", "credentialStuffing", "suspiciousUserAgent"];
const classes = checks.map((name) => require(`./checks/${name}`));
const defaults = { recognitionDays: 90, failureWindowMinutes: 15, failureThreshold: 5, ipFailureThreshold: 10, ipAccountThreshold: 5 };
function validateThresholds(preset) {
  const { medium, high } = preset.thresholds;
  if (!Number.isFinite(medium) || !Number.isFinite(high) || medium < 0 || high <= medium) throw new TypeError("Invalid risk thresholds");
}
function validateConfig(config) {
  for (const value of Object.values(config)) {
    if (!Number.isInteger(value) || value <= 0) throw new TypeError("Risk settings must be positive integers");
  }
}
function validateWeights(weights) {
  for (const value of Object.values(weights)) {
    if (!Number.isFinite(value) || value < 0) throw new TypeError("Weights must be non-negative numbers");
  }
}
function configure(options) {
  const preset = options.preset || new DefaultPreset();
  const config = { ...defaults, ...options.risk };
  validateThresholds(preset);
  validateConfig(config);
  const weights = options.weights || {};
  validateWeights(weights);
  return { preset, config, weights, checks: options.checks || classes.map((Check) => new Check()) };
}
module.exports = configure;
