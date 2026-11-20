"use strict";

const BaseCheck = require("./base");

const SUSPICIOUS_PATTERNS = [
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /hydra/i,
  /dirbuster/i,
  /masscan/i,
  /gobuster/i,
  /wpscan/i,
];

class SuspiciousUserAgentCheck extends BaseCheck {
  async run({ current }) {
    if (!current.userAgent) return { pontos: 0, motivo: null };
    const isSuspicious = SUSPICIOUS_PATTERNS.some((p) => p.test(current.userAgent));
    if (isSuspicious) {
      return { pontos: 20, motivo: "suspicious_user_agent" };
    }
    return { pontos: 0, motivo: null };
  }
}

module.exports = SuspiciousUserAgentCheck;