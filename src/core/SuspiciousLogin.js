"use strict";

const EventEmitter = require("events");
const engine = require("./scoring/engine");
class SuspiciousLogin extends EventEmitter {
  constructor(options = {}) {
    super();
    this.storage = options.storage;
    this.preset = options.preset;
    this.checks = options.checks || [];
    this.ipProvider = options.ipProvider;
    this.firstLoginGrace = options.firstLoginGrace !== false;
    this.actionInstances = options.actions || {};
  }

  async detect({ userId, ip, userAgent, success = false }) {
    const history = await this._getHistory(userId);
    if (this._isFirstLogin(history)) {
      return this._handleFirstLogin({ userId, ip, userAgent, success });
    }

    const country = await this._resolveCountry(ip);
    const current = { ip, userAgent, country, device: `${userAgent}|${ip}`, success };
    const context = { history, current };

    const results = await this._runChecks(context);
    const { score, level, reasons } = this._score(results);

    const { blocked, notified } = await this._executeActions(
      this.preset.actionsForLevel(level) || [], context, { score, level, reasons }
    );

    await this._recordAttempt({ userId, ip, userAgent, country, device: context.device, success, score, reasons, blocked });

    if (level !== "low") this._emitEvent({ userId, ip, userAgent, country, device: context.device, score, level, reasons, success, blocked, notified });

    return { allowed: !blocked, score, level, reasons, blocked, notified, firstLogin: false };
  }

  _isFirstLogin(history) {
    return history.length === 0 && this.firstLoginGrace;
  }
  async _getHistory(userId) {
    return this.storage ? await this.storage.listByUser(userId) : [];
  }

  async _handleFirstLogin({ userId, ip, userAgent, success }) {
    const device = `${userAgent}|${ip}`;
    await this._recordAttempt({ userId, ip, userAgent, country: null, device, success, score: 0, reasons: [], blocked: false });
    return { allowed: true, score: 0, level: "low", reasons: [], blocked: false, notified: false, firstLogin: true };
  }

  async _resolveCountry(ip) {
    return this.ipProvider ? await this.ipProvider.lookup(ip) : undefined;
  }

  async _runChecks(context) {
    const results = [];
    for (const check of this.checks) {
      const result = await check.run(context);
      if (result && result.pontos > 0) results.push(result);
    }
    return results;
  }

  _score(results) {
    const score = results.reduce((sum, r) => sum + r.pontos, 0);
    const level = engine.classify(score, this.preset);
    const reasons = results.map((r) => r.motivo);
    return { score, level, reasons };
  }

  async _executeActions(actionNames, context, extra) {
    let blocked = false;
    let notified = false;
    for (const name of actionNames) {
      const action = this.actionInstances[name];
      if (!action) continue;
      const outcome = await action.execute({ ...context, ...extra });
      if (outcome.blocked) blocked = true;
      if (outcome.notified) notified = true;
    }
    return { blocked, notified };
  }

  async _recordAttempt({ userId, ip, userAgent, country, device, success, score, reasons, blocked }) {
    if (!this.storage) return;
    await this.storage.create({
      user_id: userId, ip, user_agent: userAgent, country: country || null, device,
      success: !!success, score: score || 0, reasons: JSON.stringify(reasons || []),
      blocked: !!blocked, created_at: new Date().toISOString(),
    });
  }

  _emitEvent(data) {
    this.emit("SuspiciousLoginDetected", data);
  }
}

module.exports = SuspiciousLogin;