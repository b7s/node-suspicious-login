const RepeatedFailuresCheck = require("../../src/core/checks/repeatedFailures");

test("flags repeated failures (5)", async () => {
  const check = new RepeatedFailuresCheck();
  const history = Array(5).fill({ success: false });
  const result = await check.run({ history, current: {}, success: false });
  expect(result.pontos).toBe(35);
  expect(result.motivo).toBe("repeated_failures");
});

test("returns zero on success", async () => {
  const check = new RepeatedFailuresCheck();
  const result = await check.run({ history: [], current: {}, success: true });
  expect(result.pontos).toBe(0);
});

test("returns zero below threshold", async () => {
  const check = new RepeatedFailuresCheck();
  const history = Array(4).fill({ success: false });
  const result = await check.run({ history, current: {}, success: false });
  expect(result.pontos).toBe(0);
});