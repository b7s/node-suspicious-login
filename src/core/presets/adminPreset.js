"use strict";

const BasePreset = require("./base");

class AdminPreset extends BasePreset {
  constructor() {
    super();
    this.thresholds = { medium: 25, high: 50 };
    this.actionsMap = {
      low: [],
      medium: ["notify_user"],
      high: ["notify_user", "block_login"],
    };
  }
}

module.exports = AdminPreset;