const DefaultPreset = require("../../src/core/presets/defaultPreset");

test("default preset thresholds and actions", () => {
  const preset = new DefaultPreset();
  expect(preset.thresholds.medium).toBe(40);
  expect(preset.thresholds.high).toBe(70);
  expect(preset.actionsForLevel("low")).toEqual([]);
  expect(preset.actionsForLevel("medium")).toEqual(["notify_user"]);
  expect(preset.actionsForLevel("high")).toEqual(["notify_user", "block_login"]);
});