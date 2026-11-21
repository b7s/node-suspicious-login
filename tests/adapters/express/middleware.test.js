"use strict";

const request = require("supertest");
const express = require("express");
const { randomUUID } = require("crypto");
const SuspiciousLogin = require("../../../src/core/SuspiciousLogin");
const MemoryStorage = require("../../../src/core/storage/memory");
const createMiddleware = require("../../../src/adapters/express/middleware");

function appFor(detector) {
  const app = express();
  app.use(express.json());
  app.post("/login", createMiddleware(detector, { resolveAuthentication: async (req) => ({
    attemptId: randomUUID(), userId: "u1", credentialsValid: req.body.password === "correct", deviceId: "device-a",
  }) }), (req, res) => res.json({ token: "issued" }));
  app.use((error, req, res, next) => { void error; void req; void next; res.status(503).json({ error: "Unavailable" }); });
  return app;
}

test("successful credentials emit a session only after detection", async () => {
  const storage = new MemoryStorage();
  const app = appFor(new SuspiciousLogin({ storage }));
  const res = await request(app).post("/login").send({ password: "correct" });
  expect(res.status).toBe(200);
  expect(res.body.token).toBe("issued");
  expect(await storage.listByUser("u1")).toHaveLength(1);
});

test("invalid credentials are recorded with zero score and never emit a session", async () => {
  const storage = new MemoryStorage();
  const app = appFor(new SuspiciousLogin({ storage }));
  const res = await request(app).post("/login").send({ password: "wrong", success: true, userId: "other" });
  expect(res.status).toBe(401);
  expect(res.body.token).toBeUndefined();
  expect((await storage.listByUser("u1"))[0]).toMatchObject({ success: false, score: 0 });
});

test("high risk blocks even with no email action configured", async () => {
  const storage = new MemoryStorage();
  const detector = new SuspiciousLogin({ storage, checks: [{ run: () => ({ pontos: 90, motivo: "risk" }) }] });
  const res = await request(appFor(detector)).post("/login").send({ password: "correct" });
  expect(res.status).toBe(403);
  expect(res.body.token).toBeUndefined();
  expect((await storage.listByUser("u1"))[0].blocked).toBe(true);
});

test("storage failure is operational failure and never emits a session", async () => {
  const storage = { withTransaction: async () => { throw new Error("disk failure"); } };
  const res = await request(appFor(new SuspiciousLogin({ storage }))).post("/login").send({ password: "correct" });
  expect(res.status).toBe(503);
  expect(res.body.token).toBeUndefined();
});
