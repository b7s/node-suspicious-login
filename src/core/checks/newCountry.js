"use strict";

const BaseCheck = require("./base");

class NewCountryCheck extends BaseCheck {
  async run({ history, current }) {
    if (!current.country) return { pontos: 0, motivo: null };
    const known = history.some((h) => h.country === current.country);
    if (known) return { pontos: 0, motivo: null };
    return { pontos: 30, motivo: "new_country" };
  }
}

module.exports = NewCountryCheck;