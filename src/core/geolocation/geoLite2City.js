"use strict";

const maxmind = require("maxmind");

class GeoLite2City {
  static async open(path) {
    if (typeof path !== "string" || !path) throw new TypeError("A database path is required");
    return new GeoLite2City(await maxmind.open(path));
  }

  constructor(reader) {
    this.reader = reader;
  }

  async lookup(ip) {
    const record = this.reader.get(ip);
    if (!record) return null;
    return { ...this._place(record), ...this._coordinates(record) };
  }

  _place(record) {
    const city = record.city || {};
    const names = city.names || {};
    return { country: this._country(record), city: names.en ?? null };
  }

  _country(record) {
    return record.country?.iso_code ?? null;
  }

  _coordinates(record) {
    const location = record.location || {};
    return {
      latitude: location.latitude ?? null,
      longitude: location.longitude ?? null,
      accuracyRadiusKm: location.accuracy_radius ?? null,
    };
  }
}

module.exports = GeoLite2City;
