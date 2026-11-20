"use strict";

function classify(score, preset) {
  const thresholds = preset && preset.thresholds ? preset.thresholds : { medium: 40, high: 70 };
  if (score >= thresholds.high) return "high";
  if (score >= thresholds.medium) return "medium";
  return "low";
}

module.exports = { classify };