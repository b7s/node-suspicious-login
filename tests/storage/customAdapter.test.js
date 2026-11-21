"use strict";

const SuspiciousLogin = require("../../src/core/SuspiciousLogin");
const MemoryStorage = require("../../src/core/storage/memory");

test("accepts an asynchronous custom storage transaction interface", async () => {
  const inner = new MemoryStorage();
  const adapter = {
    migrate: async () => inner.migrate(),
    close: async () => inner.close(),
    prune: async (options) => inner.prune(options),
    withTransaction: async (callback) => inner.withTransaction(async (tx) => {
      const methods = ["decision", "hasEligible", "known", "hasObserved", "lastLocated", "failureCount", "ipFailures", "ipAccounts", "insert"];
      const asyncTx = Object.fromEntries(methods.map((name) => [name, async (...args) => tx[name](...args)]));
      return callback(asyncTx);
    }),
  };
  const detector = new SuspiciousLogin({ storage: adapter });
  const input = { attemptId: "one", userId: "u", credentialsValid: true, ip: "1", deviceId: "d" };
  expect((await detector.detect(input)).allowed).toBe(true);
  expect((await detector.detect({ ...input, attemptId: "two", ip: "2" })).score).toBe(10);
  await detector.close();
});
