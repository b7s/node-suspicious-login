"use strict";

const BasePreset = require("./base");

class DefaultPreset extends BasePreset {
  constructor() {
    super();
    this.thresholds = { medium: 40, high: 70 };
    this.actionsMap = {
      low: [],
      medium: ["notify_user"],
      high: ["notify_user", "block_login"],
    };
  }
}

module.exports = DefaultPreset;