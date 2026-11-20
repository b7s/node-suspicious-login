const request = require("supertest");
const express = require("express");
const SuspiciousLogin = require("../../../src/core/SuspiciousLogin");
const MemoryStorage = require("../../../src/core/storage/memory");
const DefaultPreset = require("../../../src/core/presets/defaultPreset");
const BaseCheck = require("../../../src/core/checks/base");
const BlockLogin = require("../../../src/core/actions/blockLogin");
const NotifyUser = require("../../../src/core/actions/notifyUser");
const NewDeviceCheck = require("../../../src/core/checks/newDevice");
const NewIpCheck = require("../../../src/core/checks/newIp");
const ImpossibleTravelCheck = require("../../../src/core/checks/impossibleTravel");
const createMiddleware = require("../../../src/adapters/express/middleware");

class HighScoreCheck extends BaseCheck {
  async run() {
    return { pontos: 90, motivo: "test_high_score" };
  }
}

function buildApp(suspiciousLogin) {
  const app = express();
  app.use(express.json());
  app.use(createMiddleware(suspiciousLogin, {
    userIdField: "userId",
    successField: "success",
  }));
  app.post("/login", (req, res) => {
    if (req.suspiciousLogin && req.suspiciousLogin.blocked) {
      return res.status(403).json({ success: false, blocked: true });
    }
    res.json({ success: true, token: "abc" });
  });
  return app;
}

function buildSL(checks = [], actions = {}) {
  const storage = new MemoryStorage();
  return new SuspiciousLogin({
    storage,
    preset: new DefaultPreset(),
    checks,
    actions,
  });
}

test("low risk login is allowed", async () => {
  const sl = buildSL([]);
  const app = buildApp(sl);
  const res = await request(app).post("/login").send({ userId: "u1", success: true });
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
});

test("first login is not flagged", async () => {
  const sl = buildSL([new HighScoreCheck()]);
  const app = buildApp(sl);
  const res = await request(app).post("/login").send({ userId: "newuser", success: true });
  expect(res.status).toBe(200);
});

test("high risk login is blocked", async () => {
  const sl = buildSL(
    [new HighScoreCheck()],
    { block_login: new BlockLogin(), notify_user: new NotifyUser({}) }
  );
  const app = buildApp(sl);
  await request(app).post("/login").send({ userId: "u2", success: true });
  const res = await request(app).post("/login").send({ userId: "u2", success: true });
  expect(res.status).toBe(403);
  expect(res.body.blocked).toBe(true);
});

test("emits SuspiciousLoginDetected event on high risk", async () => {
  const sl = buildSL(
    [new HighScoreCheck()],
    { block_login: new BlockLogin(), notify_user: new NotifyUser({}) }
  );
  let event = null;
  sl.on("SuspiciousLoginDetected", (e) => { event = e; });
  const app = buildApp(sl);
  await request(app).post("/login").send({ userId: "u3", success: true });
  await request(app).post("/login").send({ userId: "u3", success: true });
  expect(event).not.toBeNull();
  expect(event.level).toBe("high");
});

test("real checks: new device scores via SuspiciousLogin.detect", async () => {
  const storage = new MemoryStorage();
  const sl = new SuspiciousLogin({
    storage,
    preset: new DefaultPreset(),
    checks: [new NewDeviceCheck(), new NewIpCheck()],
  });

  // 1º login: first login grace, not flagged
  const r1 = await sl.detect({ userId: "u5", ip: "1.1.1.1", userAgent: "agent-a", success: true });
  expect(r1.firstLogin).toBe(true);
  expect(r1.score).toBe(0);

  // 2º login: same device, same IP → no new points
  const r2 = await sl.detect({ userId: "u5", ip: "1.1.1.1", userAgent: "agent-a", success: true });
  expect(r2.firstLogin).toBe(false);
  expect(r2.score).toBe(0);
  expect(r2.reasons).toEqual([]);

  // 3º login: new device (different user-agent) → new_device points (25), low risk
  const r3 = await sl.detect({ userId: "u5", ip: "1.1.1.1", userAgent: "agent-b", success: true });
  expect(r3.score).toBe(25);
  expect(r3.level).toBe("low");
  expect(r3.reasons).toContain("new_device");
  expect(r3.allowed).toBe(true);
});

test("real checks: impossible travel uses most recent attempt, not oldest", async () => {
  const storage = new MemoryStorage();
  // Histórico: BR há 1h (recente), US há 10h (antigo)
  await storage.create({
    user_id: "u6", ip: "2.2.2.2", user_agent: "agent-a", country: "BR",
    device: "agent-a|2.2.2.2", success: true, score: 0, reasons: [],
    blocked: false, created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
  });
  await storage.create({
    user_id: "u6", ip: "3.3.3.3", user_agent: "agent-a", country: "US",
    device: "agent-a|3.3.3.3", success: true, score: 0, reasons: [],
    blocked: false, created_at: new Date(Date.now() - 36000 * 1000).toISOString(),
  });

  const ipProvider = { lookup: async () => "US" };
  const sl = new SuspiciousLogin({
    storage,
    preset: new DefaultPreset(),
    checks: [new ImpossibleTravelCheck()],
    ipProvider,
  });

  // Login atual nos US, compara com a tentativa mais recente (BR, 1h atrás) → impossible travel (40 pts)
  const r = await sl.detect({ userId: "u6", ip: "4.4.4.4", userAgent: "agent-a", success: true });
  expect(r.score).toBe(40);
  expect(r.level).toBe("medium");
  expect(r.reasons).toContain("impossible_travel");
  expect(r.allowed).toBe(true);
});