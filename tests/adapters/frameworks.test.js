"use strict";

require("reflect-metadata");
const request = require("supertest");
const fastify = require("fastify");
const { Controller, Post, Module } = require("@nestjs/common");
const { NestFactory } = require("@nestjs/core");
const { randomUUID } = require("crypto");
const SuspiciousLogin = require("../../src/core/SuspiciousLogin");
const SqliteStorage = require("../../src/core/storage/sqlite");
const createMiddleware = require("../../src/adapters/express/middleware");
const AdminPreset = require("../../src/core/presets/adminPreset");

class LoginController { login() { return { token: "issued" }; } }
Controller()(LoginController);
Post("login")(LoginController.prototype, "login", Object.getOwnPropertyDescriptor(LoginController.prototype, "login"));
class AppModule {}
Module({ controllers: [LoginController] })(AppModule);
function detector() {
  return new SuspiciousLogin({ storage: new SqliteStorage(":memory:"), preset: new AdminPreset() });
}
function auth() {
  return { attemptId: randomUUID(), userId: "u", credentialsValid: true, deviceId: "original-device" };
}
async function prepareBlockedLogin(guard) {
  for (let i = 0; i < 5; i++) await guard.detect({ ...auth(), credentialsValid: false });
  return { ...auth(), deviceId: "new-device" };
}
async function exerciseLogin(guard, postLogin) {
  const allowed = await postLogin(auth());
  expect(allowed.body.token).toBe("issued");
  const blocked = await postLogin(await prepareBlockedLogin(guard));
  expect(blocked.status).toBe(403);
  expect(blocked.body.token).toBeUndefined();
  expect(guard.storage.listByUser("u").find((row) => row.blocked).reasons).toEqual(["new_device", "repeated_failures"]);
}

test("Nest on Express issues a session only when real checks allow it", async () => {
  const guard = detector();
  const app = await NestFactory.create(AppModule, { logger: false });
  let authenticated;
  app.use(createMiddleware(guard, { resolveAuthentication: () => authenticated }));
  try {
    await app.init();
    await exerciseLogin(guard, (authResult) => {
      authenticated = authResult;
      return request(app.getHttpServer()).post("/login");
    });
  } finally {
    await app.close();
    await guard.close();
  }
});
test("Fastify issues a session only when real checks allow it", async () => {
  const guard = detector();
  const app = fastify();
  let authenticated;
  app.post("/login", async (req, reply) => {
    const result = await guard.detect({ ...authenticated, ip: req.ip, userAgent: req.headers["user-agent"] });
    if (!result.allowed) return reply.code(403).send({ error: "Login denied" });
    return { token: "issued" };
  });
  try {
    await app.ready();
    await exerciseLogin(guard, (authResult) => {
      authenticated = authResult;
      return request(app.server).post("/login");
    });
  } finally {
    await app.close();
    await guard.close();
  }
});
