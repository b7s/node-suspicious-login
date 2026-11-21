"use strict";

const express = require("express");
const request = require("supertest");
const createMiddleware = require("../../../src/adapters/express/middleware");

function appFor(detector, resolveAuthentication) {
  const app = express();
  app.use(express.json());
  app.post("/login", createMiddleware(detector, { resolveAuthentication }), (req, res) => res.json({ token: "session" }));
  app.use((error, req, res, next) => {
    void error; void req; void next;
    return res.status(503).json({ error: "Unavailable" });
  });
  return app;
}

test("requires an explicit authentication resolver", () => {
  expect(() => createMiddleware({})).toThrow("resolveAuthentication is required");
});

test("uses the trusted authentication result rather than request fields", async () => {
  const detect = jest.fn().mockResolvedValue({ blocked: false });
  const app = appFor({ detect }, async () => ({ userId: "trusted", credentialsValid: false }));
  const res = await request(app).post("/login").send({ userId: "attacker", success: true });
  expect(res.status).toBe(401);
  expect(res.body.token).toBeUndefined();
  expect(detect.mock.calls[0][0]).toMatchObject({ userId: "trusted", credentialsValid: false });
});

test("does not issue a session when detection fails", async () => {
  const app = appFor({ detect: async () => { throw new Error("storage failure"); } },
    async () => ({ userId: "trusted", credentialsValid: true }));
  const res = await request(app).post("/login");
  expect(res.status).toBe(503);
  expect(res.body.token).toBeUndefined();
});

test("does not disclose risk details or issue a session when blocked", async () => {
  const app = appFor({ detect: async () => ({ blocked: true, score: 90, reasons: ["private"] }) },
    async () => ({ userId: "trusted", credentialsValid: true }));
  const res = await request(app).post("/login");
  expect(res.status).toBe(403);
  expect(res.body).toEqual({ error: "Login denied" });
});
