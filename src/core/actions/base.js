"use strict";

class BaseAction {
  async execute() {
    return { blocked: false, notified: false };
  }
}

module.exports = BaseAction;