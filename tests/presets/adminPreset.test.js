const AdminPreset = require("../../src/core/presets/adminPreset");

test("admin preset thresholds and actions", () => {
  const preset = new AdminPreset();
  expect(preset.thresholds.medium).toBe(25);
  expect(preset.thresholds.high).toBe(50);
  expect(preset.actionsForLevel("low")).toEqual([]);
  expect(preset.actionsForLevel("medium")).toEqual(["notify_user"]);
  expect(preset.actionsForLevel("high")).toEqual(["notify_user", "block_login"]);
});