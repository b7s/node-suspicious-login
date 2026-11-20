"use strict";

function extractUserId(req, field) {
  return req.body?.[field] ?? req.query?.[field];
}

function extractIp(req) {
  return req.ip || req.connection?.remoteAddress || "";
}

function extractUserAgent(req) {
  return req.get("user-agent") || "";
}

function respondBlocked(res, result, onBlock) {
  if (onBlock) return onBlock(null, res, null, result);
  return res.status(403).json({ blocked: true, score: result.score, level: result.level, reasons: result.reasons });
}

async function runDetection(suspiciousLogin, req, userIdField, successField) {
  return await suspiciousLogin.detect({
    userId: extractUserId(req, userIdField),
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
    success: req.body?.[successField] ?? false,
  });
}

function createMiddleware(suspiciousLogin, options = {}) {
  const {
    userIdField = "userId",
    successField = "success",
    onBlock = null,
  } = options;

  return async function middleware(req, res, next) {
    const userId = extractUserId(req, userIdField);
    if (!userId) return next();

    let result;
    try {
      result = await runDetection(suspiciousLogin, req, userIdField, successField);
    } catch {
      result = { allowed: true, score: 0, level: "low", reasons: [], blocked: false };
    }

    req.suspiciousLogin = result;
    if (result.blocked) return respondBlocked(res, result, onBlock);
    next();
  };
}

module.exports = createMiddleware;