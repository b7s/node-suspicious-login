"use strict";

class BasePreset {
  constructor() {
    this.thresholds = { medium: 40, high: 70 };
    this.actionsMap = {};
  }

  actionsForLevel(level) {
    return this.actionsMap[level] || [];
  }
}

module.exports = BasePreset;