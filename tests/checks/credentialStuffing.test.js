const CredentialStuffingCheck = require("../../src/core/checks/credentialStuffing");

test("flags credential stuffing (10 failures)", async () => {
  const check = new CredentialStuffingCheck();
  const history = Array(10).fill({ success: false });
  const result = await check.run({ history, current: {}, success: false });
  expect(result.pontos).toBe(40);
  expect(result.motivo).toBe("credential_stuffing");
});

test("returns zero on success", async () => {
  const check = new CredentialStuffingCheck();
  const result = await check.run({ history: [], current: {}, success: true });
  expect(result.pontos).toBe(0);
});

test("returns zero below threshold", async () => {
  const check = new CredentialStuffingCheck();
  const history = Array(9).fill({ success: false });
  const result = await check.run({ history, current: {}, success: false });
  expect(result.pontos).toBe(0);
});