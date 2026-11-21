"use strict";

const engine = require("./engine");
const evidenceFor = require("./evidence");
const groups = [new Set(["new_ip", "new_country", "impossible_travel"]), new Set(["repeated_failures", "credential_stuffing"])];

function selectResults(results) {
  const selected = results.filter((result) => result && result.pontos > 0);
  for (const group of groups) {
    const matches = selected.filter((result) => group.has(result.motivo));
    if (matches.length < 2) continue;
    const winner = matches.reduce((best, next) => next.pontos > best.pontos ? next : best);
    for (const result of matches) if (result !== winner) selected.splice(selected.indexOf(result), 1);
  }
  return selected;
}
function selectActions(preset, level) {
  const names = preset.actionsForLevel(level);
  if (!Array.isArray(names) || names.some((name) => typeof name !== "string")) throw new TypeError("Invalid action plan");
  return [...names];
}
async function evaluate(tx, current, options) {
  if (!current.credentialsValid) {
    return { result: { score: 0, level: "low", reasons: [], blocked: false, firstLogin: false }, actionNames: [] };
  }
  const evidence = await evidenceFor(tx, current, options.config);
  const raw = await Promise.all(options.checks.map((check) => check.run({ current, evidence })));
  if (raw.some((result) => !result || !Number.isFinite(result.pontos) || result.pontos < 0)) throw new TypeError("Invalid check result");
  const weighted = raw.map((result) => result.pontos > 0 ? { ...result, pontos: options.weights[result.motivo] ?? result.pontos } : result);
  const results = selectResults(weighted);
  const score = results.reduce((sum, result) => sum + result.pontos, 0);
  const level = engine.classify(score, options.preset);
  const actionNames = selectActions(options.preset, level);
  const result = { score, level, reasons: results.map((item) => item.motivo),
    blocked: actionNames.includes("block_login"), firstLogin: !evidence.hasEligible };
  return { result, actionNames };
}
module.exports = evaluate;
