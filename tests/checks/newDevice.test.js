const NewDeviceCheck = require("../../src/core/checks/newDevice");

test("returns points for a new device", async () => {
  const check = new NewDeviceCheck();
  const result = await check.run({
    history: [],
    current: { device: "ua|ip" },
  });
  expect(result.pontos).toBe(25);
  expect(result.motivo).toBe("new_device");
});

test("returns zero points for a known device", async () => {
  const check = new NewDeviceCheck();
  const result = await check.run({
    history: [{ device: "ua|ip" }],
    current: { device: "ua|ip" },
  });
  expect(result.pontos).toBe(0);
  expect(result.motivo).toBeNull();
});