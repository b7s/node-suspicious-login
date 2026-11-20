"use strict";

const BaseCheck = require("./base");

class NewIpCheck extends BaseCheck {
  async run({ history, current }) {
    const known = history.some((h) => h.ip === current.ip);
    if (known) return { pontos: 0, motivo: null };
    return { pontos: 10, motivo: "new_ip" };
  }
}

module.exports = NewIpCheck;