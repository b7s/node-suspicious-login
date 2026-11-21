"use strict";

async function runDetection(detector, resolver, req) {
  const auth = await resolver(req);
  if (!auth || typeof auth.credentialsValid !== "boolean") throw new TypeError("Invalid authentication result");
  const result = await detector.detect({
    attemptId: auth.attemptId,
    userId: auth.userId ?? null,
    credentialsValid: auth.credentialsValid,
    email: auth.email,
    deviceId: auth.deviceId,
    ip: req.ip,
    userAgent: req.get("user-agent") || "",
  });
  return { auth, result };
}
function createMiddleware(suspiciousLogin, options = {}) {
  if (typeof options.resolveAuthentication !== "function") throw new TypeError("resolveAuthentication is required");
  return async function middleware(req, res, next) {
    try {
      const { auth, result } = await runDetection(suspiciousLogin, options.resolveAuthentication, req);
      req.suspiciousLogin = result;
      if (!auth.credentialsValid) return res.status(401).json({ error: "Authentication failed" });
      if (!result.allowed) return res.status(403).json({ error: "Login denied" });
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
module.exports = createMiddleware;
