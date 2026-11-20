const MemoryStorage = require("../../src/core/storage/memory");

test("creates and lists attempts by user", async () => {
  const storage = new MemoryStorage();
  await storage.create({
    user_id: "u1",
    ip: "1.2.3.4",
    user_agent: "ua",
    country: "BR",
    device: "ua|1.2.3.4",
    success: true,
    score: 0,
    reasons: [],
    blocked: false,
    created_at: new Date(Date.now() - 1000).toISOString(),
  });
  await storage.create({
    user_id: "u1",
    ip: "5.6.7.8",
    user_agent: "ua2",
    country: "US",
    device: "ua2|5.6.7.8",
    success: false,
    score: 50,
    reasons: ["new_country"],
    blocked: true,
    created_at: new Date().toISOString(),
  });

  const byUser = await storage.listByUser("u1");
  expect(byUser.length).toBe(2);
  expect(byUser[0].user_id).toBe("u1");
  const blockedOne = byUser.find((r) => r.blocked);
  expect(blockedOne).not.toBeUndefined();
  expect(blockedOne.blocked).toBe(true);

  const empty = await storage.listByUser("u2");
  expect(empty.length).toBe(0);
});