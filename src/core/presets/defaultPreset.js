"use strict";

const BasePreset = require("./base");

class DefaultPreset extends BasePreset {
  constructor() {
    super();
    this.thresholds = { medium: 40, high: 70 };
  }
}

module.exports = DefaultPreset;