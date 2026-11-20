"use strict";

const SuspiciousLogin = require("./core/SuspiciousLogin");
const createMiddleware = require("./adapters/express/middleware");

const checks = {
  newDevice: require("./core/checks/newDevice"),
  newIp: require("./core/checks/newIp"),
  newCountry: require("./core/checks/newCountry"),
  impossibleTravel: require("./core/checks/impossibleTravel"),
  repeatedFailures: require("./core/checks/repeatedFailures"),
  credentialStuffing: require("./core/checks/credentialStuffing"),
  suspiciousUserAgent: require("./core/checks/suspiciousUserAgent"),
};

const storage = {
  base: require("./core/storage/base"),
  sqlite: require("./core/storage/sqlite"),
  memory: require("./core/storage/memory"),
};

const presets = {
  base: require("./core/presets/base"),
  defaultPreset: require("./core/presets/defaultPreset"),
  adminPreset: require("./core/presets/adminPreset"),
};

const actions = {
  base: require("./core/actions/base"),
  notifyUser: require("./core/actions/notifyUser"),
  blockLogin: require("./core/actions/blockLogin"),
  customAction: require("./core/actions/customAction"),
};

const engine = require("./core/scoring/engine");

module.exports = {
  SuspiciousLogin,
  createMiddleware,
  checks,
  storage,
  presets,
  actions,
  engine,
};