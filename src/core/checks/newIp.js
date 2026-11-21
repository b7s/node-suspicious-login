"use strict";
class NewIpCheck {
  run({ current, evidence }) {
    if (evidence.hasEligible && current.ip && !evidence.knownIp) return { pontos: 10, motivo: "new_ip" };
    return { pontos: 0, motivo: null };
  }
}
module.exports = NewIpCheck;
