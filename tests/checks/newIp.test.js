const Check = require("../../src/core/checks/newIp");
test("new IP is scored only when trusted history exists", () => {
  const check = new Check();
  expect(check.run({current: {ip: "2"}, evidence: {hasEligible: true, knownIp: false}}).pontos).toBe(10);
  expect(check.run({current: {ip: "2"}, evidence: {hasEligible: true, knownIp: true}}).pontos).toBe(0);
  expect(check.run({current: {ip: "2"}, evidence: {hasEligible: false}}).pontos).toBe(0);
});
