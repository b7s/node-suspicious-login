"use strict";

jest.mock("maxmind", () => ({ open: jest.fn() }));
const maxmind = require("maxmind");
const GeoLite2City = require("../../src/core/geolocation/geoLite2City");

test("opens the configured database and maps location and accuracy", async () => {
  const get = jest.fn().mockReturnValue({
    country: { iso_code: "BR" }, city: { names: { en: "São Paulo" } },
    location: { latitude: -23.5, longitude: -46.6, accuracy_radius: 50 },
  });
  maxmind.open.mockResolvedValue({ get });
  const provider = await GeoLite2City.open("/data/GeoLite2-City.mmdb");
  expect(await provider.lookup("200.1.2.3")).toEqual({
    country: "BR", city: "São Paulo", latitude: -23.5,
    longitude: -46.6, accuracyRadiusKm: 50,
  });
  expect(get).toHaveBeenCalledWith("200.1.2.3");
});

test("handles unknown addresses and incomplete records", async () => {
  const provider = new GeoLite2City({ get: jest.fn().mockReturnValueOnce(null).mockReturnValueOnce({}) });
  expect(await provider.lookup("::1")).toBeNull();
  expect(await provider.lookup("::2")).toEqual({
    country: null, city: null, latitude: null, longitude: null, accuracyRadiusKm: null,
  });
});

test("reports database open failures", async () => {
  maxmind.open.mockRejectedValueOnce(new Error("database unavailable"));
  await expect(GeoLite2City.open("/missing.mmdb")).rejects.toThrow("database unavailable");
});
