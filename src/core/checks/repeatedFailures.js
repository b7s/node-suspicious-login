"use strict";

const BaseCheck = require("./base");

class RepeatedFailuresCheck extends BaseCheck {
  async run({ history, success }) {
    if (success) return { pontos: 0, motivo: null };
    const recentFailures = history.filter((h) => !h.success).slice(-5);
    if (recentFailures.length >= 5) {
      return { pontos: 35, motivo: "repeated_failures" };
    }
    return { pontos: 0, motivo: null };
  }
}

module.exports = RepeatedFailuresCheck;