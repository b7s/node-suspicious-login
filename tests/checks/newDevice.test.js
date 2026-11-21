const Check = require("../../src/core/checks/newDevice");
test("a device is scored only when an identifier and trusted history exist", () => {
  const check = new Check();
  expect(check.run({current: {deviceId: "new"}, evidence: {hasDeviceHistory: true, knownDevice: false}}).pontos).toBe(25);
  expect(check.run({current: {deviceId: "known"}, evidence: {hasDeviceHistory: true, knownDevice: true}}).pontos).toBe(0);
  expect(check.run({current: {}, evidence: {hasDeviceHistory: true}}).pontos).toBe(0);
  expect(check.run({current: {deviceId: "new"}, evidence: {hasDeviceHistory: false}}).pontos).toBe(0);
});
