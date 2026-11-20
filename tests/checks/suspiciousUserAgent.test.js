const SuspiciousUserAgentCheck = require("../../src/core/checks/suspiciousUserAgent");

test("flags suspicious user agent", async () => {
  const check = new SuspiciousUserAgentCheck();
  const result = await check.run({ current: { userAgent: "sqlmap/1.0" } });
  expect(result.pontos).toBe(20);
  expect(result.motivo).toBe("suspicious_user_agent");
});

test("returns zero for normal user agent", async () => {
  const check = new SuspiciousUserAgentCheck();
  const result = await check.run({
    current: { userAgent: "Mozilla/5.0 Chrome/120" },
  });
  expect(result.pontos).toBe(0);
});

test("returns zero when user agent missing", async () => {
  const check = new SuspiciousUserAgentCheck();
  const result = await check.run({ current: {} });
  expect(result.pontos).toBe(0);
});