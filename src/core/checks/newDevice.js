"use strict";

const BaseCheck = require("./base");

class NewDeviceCheck extends BaseCheck {
  async run({ history, current }) {
    const known = history.some((h) => h.device === current.device);
    if (known) return { pontos: 0, motivo: null };
    return { pontos: 25, motivo: "new_device" };
  }
}

module.exports = NewDeviceCheck;