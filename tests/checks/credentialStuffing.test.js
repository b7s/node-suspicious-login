const Check = require("../../src/core/checks/credentialStuffing");
test("requires both the failure and distinct account thresholds", () => {
  const check = new Check();
  const evidence = {ipFailures: 10, ipAccounts: 5, ipFailureThreshold: 10, ipAccountThreshold: 5};
  expect(check.run({evidence}).pontos).toBe(40);
  expect(check.run({evidence: {...evidence, ipAccounts: 1}}).pontos).toBe(0);
  expect(check.run({evidence: {...evidence, ipFailures: 9}}).pontos).toBe(0);
});
