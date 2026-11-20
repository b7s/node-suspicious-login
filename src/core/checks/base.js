"use strict";

class BaseCheck {
  async run() {
    return { pontos: 0, motivo: null };
  }
}

module.exports = BaseCheck;