"use strict";
class NewDeviceCheck {
  run({ current, evidence }) {
    if (evidence.hasDeviceHistory && current.deviceId && !evidence.knownDevice) return { pontos: 25, motivo: "new_device" };
    return { pontos: 0, motivo: null };
  }
}
module.exports = NewDeviceCheck;
