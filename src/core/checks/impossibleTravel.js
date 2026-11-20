"use strict";

const BaseCheck = require("./base");
const HOURS_THRESHOLD = 4;

class ImpossibleTravelCheck extends BaseCheck {
  async run({ history, current }) {
    const last = this._lastAttempt(history);
    if (!this._hasDifferentCountry(last, current)) return { pontos: 0, motivo: null };
    if (!this._isWithinThreshold(last)) return { pontos: 0, motivo: null };
    return { pontos: 40, motivo: "impossible_travel" };
  }

  _lastAttempt(history) {
    return history[0];
  }

  _hasDifferentCountry(last, current) {
    return Boolean(last && last.country && current.country && last.country !== current.country);
  }

  _isWithinThreshold(last) {
    if (!last.created_at) return false;
    const hoursDiff = this._hoursDiff(last.created_at);
    return hoursDiff < HOURS_THRESHOLD;
  }

  _hoursDiff(createdAt) {
    const prevTime = new Date(createdAt).getTime();
    const now = new Date().getTime();
    return (now - prevTime) / (1000 * 60 * 60);
  }
}

module.exports = ImpossibleTravelCheck;