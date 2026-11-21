"use strict";

const BasePreset = require("./base");

class AdminPreset extends BasePreset {
  constructor() {
    super();
    this.thresholds = { medium: 25, high: 50 };
  }
}

module.exports = AdminPreset;