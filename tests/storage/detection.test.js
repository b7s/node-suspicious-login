"use strict";

const SuspiciousLogin = require("../../src/core/SuspiciousLogin");
const SqliteStorage = require("../../src/core/storage/sqlite");
const AdminPreset = require("../../src/core/presets/adminPreset");
const BRAZIL = { country: "BR", latitude: -23.55, longitude: -46.63, accuracyRadiusKm: 10 };
const USA = { country: "US", latitude: 40.71, longitude: -74, accuracyRadiusKm: 10 };
const provider = { lookup: async (ip) => ip === "us" ? USA : BRAZIL };
function login(id, ip = "br", extra = {}) {
  return { attemptId: id, userId: "u", credentialsValid: true, ip, userAgent: "browser", deviceId: "device", ...extra };
}
function setup(options = {}) {
  const storage = new SqliteStorage(":memory:");
  return { storage, detector: new SuspiciousLogin({ storage, ipProvider: provider, ...options }) };
}
test("first login records country; changing only IP scores only IP", async () => {
  const { storage, detector } = setup();
  expect(await detector.detect(login("a"))).toMatchObject({ score: 0, firstLogin: true });
  expect(await detector.detect(login("b", "other"))).toMatchObject({ score: 10, reasons: ["new_ip"] });
  expect(storage.listByUser("u")[1].country).toBe("BR");
  await detector.close();
});
test("country and impossible travel are not double counted", async () => {
  const { storage, detector } = setup();
  await storage.create({ user_id: "u", ip: "br", device: "device", country: "BR", latitude: BRAZIL.latitude,
    longitude: BRAZIL.longitude, accuracy_radius_km: 10, success: true, created_at: new Date(Date.now() - 3600000).toISOString() });
  const result = await detector.detect(login("b", "us"));
  expect(result.score).toBe(40);
  expect(result.reasons).toEqual(["impossible_travel"]);
  await detector.close();
});
test("recent failures affect the next success, stale failures do not, and invalid credentials score zero", async () => {
  const { storage, detector } = setup();
  for (let i = 0; i < 5; i++) {
    expect(await detector.detect(login(`f${i}`, "br", { credentialsValid: false }))).toMatchObject({ score: 0, allowed: false });
  }
  expect((await detector.detect(login("success"))).reasons).toContain("repeated_failures");
  await storage.prune({ before: new Date(Date.now() + 1000).toISOString(), limit: 10 });
  for (let i = 0; i < 5; i++) await storage.create({ user_id: "u", ip: "br", success: false, created_at: "2020-01-01T00:00:00.000Z" });
  expect((await detector.detect(login("new"))).reasons).not.toContain("repeated_failures");
  await detector.close();
});
test("the failure window includes its exact boundary and excludes older rows", async () => {
  jest.useFakeTimers().setSystemTime(new Date("2026-01-01T12:00:00.000Z"));
  const { storage, detector } = setup();
  try {
    for (let i = 0; i < 4; i++) await storage.create({ user_id: "u", ip: "br", success: false, created_at: "2026-01-01T11:45:00.000Z" });
    await storage.create({ user_id: "u", ip: "br", success: false, created_at: "2026-01-01T11:44:59.999Z" });
    expect((await detector.detect(login("before"))).reasons).not.toContain("repeated_failures");
    await storage.create({ user_id: "u", ip: "br", success: false, created_at: "2026-01-01T11:45:00.000Z" });
    expect((await detector.detect(login("boundary"))).reasons).toContain("repeated_failures");
  } finally {
    await detector.close();
    jest.useRealTimers();
  }
});
test("many failures on one account do not imply credential stuffing", async () => {
  const { detector } = setup();
  for (let i = 0; i < 10; i++) await detector.detect(login(`f${i}`, "br", { credentialsValid: false }));
  const result = await detector.detect(login("ok"));
  expect(result.reasons).toContain("repeated_failures");
  expect(result.reasons).not.toContain("credential_stuffing");
  await detector.close();
});
test("credential stuffing requires failures spread across distinct known accounts", async () => {
  const { detector } = setup();
  for (let i = 0; i < 10; i++) await detector.detect(login(`f${i}`, "br", { userId: `u${i % 5}`, credentialsValid: false }));
  const result = await detector.detect(login("ok"));
  expect(result.reasons).toContain("credential_stuffing");
  await detector.close();
});
test("replaying an attempt is idempotent and unknown users cannot be authorized", async () => {
  const { storage, detector } = setup();
  const input = login("a");
  await detector.detect(input);
  expect((await detector.detect(input)).duplicate).toBe(true);
  expect(storage.listByUser("u")).toHaveLength(1);
  await expect(detector.detect(login("bad", "br", { userId: null }))).rejects.toThrow("userId");
  expect((await detector.detect(login("unknown", "br", { userId: null, credentialsValid: false }))).allowed).toBe(false);
  await detector.close();
});
test("a slow geolocation provider receives cancellation when the lookup times out", async () => {
  const cancelled = jest.fn();
  const { detector } = setup({
    locationTimeoutMs: 10,
    ipProvider: { lookup: (_, { signal }) => new Promise((_, reject) => {
      signal.addEventListener("abort", () => {
        cancelled();
        reject(signal.reason);
      }, { once: true });
    }) },
  });
  expect((await detector.detect(login("slow"))).allowed).toBe(true);
  expect(cancelled).toHaveBeenCalledTimes(1);
  await detector.close();
});
test("invalid credentials and stored replays skip geolocation", async () => {
  const lookup = jest.fn(() => BRAZIL);
  const { storage, detector } = setup({ ipProvider: { lookup } });
  const invalid = login("invalid", "br", { credentialsValid: false });
  expect(await detector.detect(invalid)).toMatchObject({ allowed: false, duplicate: false });
  expect(await detector.detect(invalid)).toMatchObject({ allowed: false, duplicate: true });
  expect(lookup).not.toHaveBeenCalled();
  expect(await detector.detect(login("valid"))).toMatchObject({ allowed: true, duplicate: false });
  expect(await detector.detect(login("valid"))).toMatchObject({ allowed: true, duplicate: true });
  await expect(detector.detect(login("valid", "br", { userId: "another" }))).rejects.toThrow("Suspicious login detection failed");
  expect(lookup).toHaveBeenCalledTimes(1);
  expect(storage.listByUser("u")).toHaveLength(2);
  await detector.close();
});
test("concurrent requests recheck the attempt ID after lookup", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const { storage, detector } = setup({ ipProvider: { lookup: () => pending } });
  const first = detector.detect(login("shared"));
  const second = detector.detect(login("shared"));
  release(BRAZIL);
  const results = await Promise.all([first, second]);
  expect(results.map((result) => result.duplicate).sort()).toEqual([false, true]);
  expect(storage.listByUser("u")).toHaveLength(1);
  await detector.close();
});
test("the first country after an outage establishes a baseline without blocking", async () => {
  let location = null;
  const { detector } = setup({ preset: new AdminPreset(), ipProvider: { lookup: () => location } });
  await detector.detect(login("during-outage"));
  location = BRAZIL;
  expect(await detector.detect(login("after-outage", "br", { deviceId: "another" })))
    .toMatchObject({ allowed: true, score: 25, reasons: ["new_device"] });
  location = { country: "AR" };
  expect(await detector.detect(login("new-country", "br", { deviceId: "another" })))
    .toMatchObject({ allowed: true, score: 30, reasons: ["new_country"] });
  await detector.close();
});
test("the first device ID establishes a baseline after logins without one", async () => {
  const { detector } = setup();
  await detector.detect(login("without-device", "br", { deviceId: null }));
  expect(await detector.detect(login("first-device"))).toMatchObject({ score: 0, firstLogin: false });
  expect(await detector.detect(login("new-device", "br", { deviceId: "another" })))
    .toMatchObject({ score: 25, reasons: ["new_device"] });
  await detector.close();
});
test("geolocation failure does not prevent the remaining checks", async () => {
  const { detector } = setup({ ipProvider: { lookup: async () => { throw new Error("offline"); } } });
  expect((await detector.detect(login("a"))).allowed).toBe(true);
  expect((await detector.detect(login("b", "other"))).reasons).toContain("new_ip");
  await detector.close();
});
