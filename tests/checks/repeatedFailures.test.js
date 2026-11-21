const Check = require("../../src/core/checks/repeatedFailures");
test("scores the configured account failure threshold", () => {
  const check = new Check();
  expect(check.run({evidence: {accountFailures: 5, failureThreshold: 5}}).pontos).toBe(35);
  expect(check.run({evidence: {accountFailures: 4, failureThreshold: 5}}).pontos).toBe(0);
});
