"use strict";

const BaseAction = require("./base");

class NotifyUserAction extends BaseAction {
  constructor(options = {}) {
    super();
    this.transporter = options.transporter;
    this.from = options.from || "noreply@example.com";
    this.appUrl = options.appUrl || "http://localhost:3000";
  }

  async execute({ email, ip, country, score, level }) {
    if (!this.transporter || !email) return { blocked: false, notified: false };

    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: `Suspicious login detected (${level})`,
      text: `A suspicious login was detected from IP ${ip}${country ? ` in ${country}` : ""}. Score: ${score}. Level: ${level}.`,
    });

    return { blocked: false, notified: true };
  }
}

module.exports = NotifyUserAction;