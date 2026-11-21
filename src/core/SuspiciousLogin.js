"use strict";

const EventEmitter = require("events");
const { setImmediate } = require("timers");
const SqliteStorage = require("./storage/sqlite");
const GeoLite2City = require("./geolocation/geoLite2City");
const resolveLocation = require("./geolocation/resolve");
const { attempt, withLocation } = require("./attempt");
const configure = require("./config");
const { execute, replay } = require("./scoring/transaction");

function operationalOptions(options) {
  return { locationTimeoutMs: options.locationTimeoutMs ?? 1000, actions: options.actions || {},
    onEffectError: options.onEffectError || ((error) => process.emitWarning(error)) };
}
class DetectionError extends Error {
  constructor(cause) { super("Suspicious login detection failed", { cause }); this.name = "DetectionError"; }
}
class SuspiciousLogin extends EventEmitter {
  static async open(options = {}) {
    const ipProvider = options.ipProvider || (options.geoLite2Path ? await GeoLite2City.open(options.geoLite2Path) : undefined);
    return new SuspiciousLogin({ ...options, ipProvider });
  }
  constructor(options = {}) {
    super();
    Object.assign(this, configure(options), operationalOptions(options));
    this.storage = options.storage || new SqliteStorage(options.dbPath);
    this.ipProvider = options.ipProvider;
    if (!Number.isFinite(this.locationTimeoutMs) || this.locationTimeoutMs <= 0) throw new TypeError("Invalid location timeout");
  }
  async detect(input) {
    const current = attempt(input);
    try {
      return await this.decide(current);
    } catch (error) {
      throw new DetectionError(error);
    }
  }
  async decide(current) {
    if (this.shouldLocate(current)) {
      const previous = await this.readReplay(current);
      if (previous) return previous;
      const location = await resolveLocation(this.ipProvider, current.ip, this.locationTimeoutMs, (error) => this.report(error));
      current = withLocation(current, location);
    }
    const { result, actionNames } = await this.storage.withTransaction((tx) => execute(tx, current, this));
    if (!result.duplicate && result.level !== "low") this.dispatch(current, result, actionNames);
    return result;
  }
  shouldLocate(current) { return current.credentialsValid && current.ip && this.ipProvider; }
  async readReplay(current) {
    const id = current.attemptId;
    const previous = typeof this.storage.readDecision === "function"
      ? await this.storage.readDecision(id) : await this.storage.withTransaction((tx) => tx.decision(id));
    return replay(previous, current);
  }
  dispatch(current, result, actionNames) {
    const payload = { ...current, ...result, reasons: [...result.reasons] };
    setImmediate(() => this.runEffect(() => {
      for (const name of actionNames) {
        if (name === "block_login") continue;
        this.runEffect(() => this.actions[name]?.execute({ ...payload }));
      }
      for (const listener of this.rawListeners("SuspiciousLoginDetected")) {
        this.runEffect(() => listener.call(this, { ...payload }));
      }
    }));
  }
  runEffect(effect) {
    Promise.resolve().then(effect).catch((error) => this.report(error));
  }
  report(error) {
    try { Promise.resolve(this.onEffectError(error)).catch(() => undefined); } catch { /* reporting is independent of the decision */ }
  }
  async close() { await this.storage.close(); }
}
SuspiciousLogin.DetectionError = DetectionError;
module.exports = SuspiciousLogin;
