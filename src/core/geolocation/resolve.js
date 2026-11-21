"use strict";

const { setTimeout, clearTimeout } = require("timers");
function timedLookup(provider, ip, timeoutMs) {
  const controller = new globalThis.AbortController();
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      resolve(null);
      controller.abort();
    }, timeoutMs);
  });
  const lookup = Promise.resolve().then(() => provider.lookup(ip, { signal: controller.signal }));
  return Promise.race([lookup, timeout]).finally(() => clearTimeout(timer));
}
async function resolveLocation(provider, ip, timeoutMs, onError) {
  if (!provider || !ip) return {};
  try {
    const value = await timedLookup(provider, ip, timeoutMs);
    return Object(value) === value ? value : {};
  } catch (error) {
    onError(error);
    return {};
  }
}
module.exports = resolveLocation;
