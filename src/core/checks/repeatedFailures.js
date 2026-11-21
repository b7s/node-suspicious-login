"use strict";
class RepeatedFailuresCheck {
  run({ evidence }) {
    if (evidence.accountFailures >= evidence.failureThreshold) return { pontos: 35, motivo: "repeated_failures" };
    return { pontos: 0, motivo: null };
  }
}
module.exports = RepeatedFailuresCheck;
