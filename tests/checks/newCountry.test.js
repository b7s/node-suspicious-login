const Check = require("../../src/core/checks/newCountry");
test("a country is scored only when available and absent from trusted history", () => {
  const check = new Check();
  expect(check.run({current: {country: "BR"}, evidence: {hasCountryHistory: true, knownCountry: false}}).pontos).toBe(30);
  expect(check.run({current: {country: "BR"}, evidence: {hasCountryHistory: true, knownCountry: true}}).pontos).toBe(0);
  expect(check.run({current: {}, evidence: {hasCountryHistory: true}}).pontos).toBe(0);
});
