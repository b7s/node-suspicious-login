"use strict";

class BasePreset {
  constructor() {
    this.thresholds = { medium: 40, high: 70 };
    this.actionsMap = {
      low: [],
      medium: ["notify_user"],
      high: ["notify_user", "block_login"],
    };
  }

  actionsForLevel(level) {
    return this.actionsMap[level] || [];
  }
}

module.exports = BasePreset;