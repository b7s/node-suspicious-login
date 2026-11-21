"use strict";

const { setImmediate } = require("timers");
const SuspiciousLogin = require("../../../src/core/SuspiciousLogin");
const MemoryStorage = require("../../../src/core/storage/memory");
const DefaultPreset = require("../../../src/core/presets/defaultPreset");

function detector(storage, action, onEffectError) {
  return new SuspiciousLogin({
    storage, onEffectError,
    checks: [{ run: () => ({ pontos: 90, motivo: "risk" }) }],
    actions: { notify_user: action },
  });
}
function tick() { return new Promise((resolve) => setImmediate(resolve)); }
test("persists a block before starting notification and does not wait for it", async () => {
  const storage = new MemoryStorage();
  const execute = jest.fn(() => new Promise(() => {}));
  const sl = detector(storage, { execute });
  const input = { attemptId: "a", userId: "user", email: "verified@example.com", ip: "1.2.3.4", credentialsValid: true };
  const result = await sl.detect(input);
  expect(result.blocked).toBe(true);
  expect((await storage.listByUser("user"))[0].blocked).toBe(true);
  await tick();
  expect(execute).toHaveBeenCalledWith(expect.objectContaining({ email: "verified@example.com", ip: "1.2.3.4" }));
  expect((await sl.detect(input)).duplicate).toBe(true);
  await tick();
  expect(execute).toHaveBeenCalledTimes(1);
});
test("does not start external effects when persistence fails", async () => {
  const execute = jest.fn();
  const storage = { withTransaction: async () => { throw new Error("disk failure"); } };
  await expect(detector(storage, { execute }).detect({ attemptId: "a", userId: "user", credentialsValid: true }))
    .rejects.toThrow("Suspicious login detection failed");
  await tick();
  expect(execute).not.toHaveBeenCalled();
});
test("reports failed effects and listener exceptions without changing the decision", async () => {
  const report = jest.fn();
  const sl = detector(new MemoryStorage(), { execute: async () => { throw new Error("smtp"); } }, report);
  sl.on("SuspiciousLoginDetected", () => { throw new Error("listener"); });
  expect((await sl.detect({ attemptId: "a", userId: "user", credentialsValid: true })).blocked).toBe(true);
  await tick();
  expect(report).toHaveBeenCalledTimes(2);
});
test("resolves the preset once and reports errors while resolving the configured effect", async () => {
  const preset = new DefaultPreset();
  preset.actionsForLevel = jest.fn()
    .mockReturnValueOnce(["block_login", "notify_user"])
    .mockImplementation(() => { throw new Error("preset called twice"); });
  const error = new Error("effect unavailable");
  const actions = { get notify_user() { throw error; } };
  const report = jest.fn();
  const listener = jest.fn();
  const storage = new MemoryStorage();
  const sl = new SuspiciousLogin({
    storage, preset, actions, onEffectError: report,
    checks: [{ run: () => ({ pontos: 90, motivo: "risk" }) }],
  });
  sl.on("SuspiciousLoginDetected", listener);
  expect(await sl.detect({ attemptId: "a", userId: "user", credentialsValid: true })).toMatchObject({ blocked: true });
  await tick();
  expect(preset.actionsForLevel).toHaveBeenCalledTimes(1);
  expect(report).toHaveBeenCalledWith(error);
  expect(listener).toHaveBeenCalledTimes(1);
  expect(storage.listByUser("user")[0].blocked).toBe(true);
});
