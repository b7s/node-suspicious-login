const BlockLogin = require("../../src/core/actions/blockLogin");

test("blocks login", async () => {
  const action = new BlockLogin();
  const result = await action.execute({});
  expect(result.blocked).toBe(true);
  expect(result.notified).toBe(false);
});