"use strict";

const BaseCheck = require("./base");

class CredentialStuffingCheck extends BaseCheck {
  async run({ history, success }) {
    if (success) return { pontos: 0, motivo: null };
    const failures = history.filter((h) => !h.success);
    if (failures.length >= 10) {
      return { pontos: 40, motivo: "credential_stuffing" };
    }
    return { pontos: 0, motivo: null };
  }
}

module.exports = CredentialStuffingCheck;