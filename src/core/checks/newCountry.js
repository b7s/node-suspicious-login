"use strict";
class NewCountryCheck {
  run({ current, evidence }) {
    if (evidence.hasCountryHistory && current.country && !evidence.knownCountry) return { pontos: 30, motivo: "new_country" };
    return { pontos: 0, motivo: null };
  }
}
module.exports = NewCountryCheck;
