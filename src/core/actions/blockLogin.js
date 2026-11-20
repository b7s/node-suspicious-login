"use strict";

const BaseAction = require("./base");

class BlockLoginAction extends BaseAction {
  async execute() {
    return { blocked: true, notified: false };
  }
}

module.exports = BlockLoginAction;