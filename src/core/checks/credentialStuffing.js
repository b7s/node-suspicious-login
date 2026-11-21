"use strict";
class CredentialStuffingCheck {
  run({ evidence }) {
    if (evidence.ipFailures >= evidence.ipFailureThreshold && evidence.ipAccounts >= evidence.ipAccountThreshold) {
      return { pontos: 40, motivo: "credential_stuffing" };
    }
    return { pontos: 0, motivo: null };
  }
}
module.exports = CredentialStuffingCheck;
