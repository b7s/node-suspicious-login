const Check = require("../../src/core/checks/impossibleTravel");
const now = "2026-01-02T12:00:00.000Z";
const brazil = {latitude: -23.55, longitude: -46.63, accuracyRadiusKm: 10, createdAt: "2026-01-02T11:00:00.000Z"};
const usa = {latitude: 40.71, longitude: -74, accuracyRadiusKm: 10, createdAt: now};
test("detects implausible long distance travel with accuracy radii", () => {
  const check = new Check();
  expect(check.run({current: usa, evidence: {lastLocated: brazil}}).pontos).toBe(40);
  expect(check.run({current: {...usa, accuracyRadiusKm: 10000}, evidence: {lastLocated: brazil}}).pontos).toBe(0);
  expect(check.run({current: {...usa, createdAt: "2026-01-04T12:00:00.000Z"}, evidence: {lastLocated: brazil}}).pontos).toBe(0);
});
test("does not infer impossible travel without accurate coordinates or across nearby borders", () => {
  const check = new Check();
  expect(check.run({current: {country: "US"}, evidence: {lastLocated: brazil}}).pontos).toBe(0);
  expect(check.run({current: {...brazil, longitude: -46, createdAt: now}, evidence: {lastLocated: brazil}}).pontos).toBe(0);
  expect(check.run({current: usa, evidence: {lastLocated: null}}).pontos).toBe(0);
});
