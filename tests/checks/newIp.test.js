const NewIpCheck = require("../../src/core/checks/newIp");

test("returns points for a new IP", async () => {
  const check = new NewIpCheck();
  const result = await check.run({
    history: [],
    current: { ip: "1.2.3.4" },
  });
  expect(result.pontos).toBe(10);
  expect(result.motivo).toBe("new_ip");
});

test("returns zero points for a known IP", async () => {
  const check = new NewIpCheck();
  const result = await check.run({
    history: [{ ip: "1.2.3.4" }],
    current: { ip: "1.2.3.4" },
  });
  expect(result.pontos).toBe(0);
  expect(result.motivo).toBeNull();
});