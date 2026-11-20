const { classify } = require("../../src/core/scoring/engine");

const preset = { thresholds: { medium: 40, high: 70 } };

test("classifies low score", () => {
  expect(classify(10, preset)).toBe("low");
});

test("classifies medium score", () => {
  expect(classify(50, preset)).toBe("medium");
  expect(classify(40, preset)).toBe("medium");
});

test("classifies high score", () => {
  expect(classify(80, preset)).toBe("high");
  expect(classify(70, preset)).toBe("high");
});

test("uses default thresholds when preset missing", () => {
  expect(classify(80, {})).toBe("high");
  expect(classify(50, {})).toBe("medium");
  expect(classify(10, {})).toBe("low");
});