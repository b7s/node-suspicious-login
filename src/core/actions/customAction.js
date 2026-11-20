"use strict";

const BaseAction = require("./base");

class CustomAction extends BaseAction {
  constructor(handler) {
    super();
    this.handler = handler;
  }

  async execute(context) {
    const result = await this.handler(context) || {};
    return {
      blocked: !!result.blocked,
      notified: !!result.notified,
    };
  }
}

module.exports = CustomAction;