const NewCountryCheck = require("../../src/core/checks/newCountry");

test("returns points for a new country", async () => {
  const check = new NewCountryCheck();
  const result = await check.run({
    history: [],
    current: { country: "BR" },
  });
  expect(result.pontos).toBe(30);
  expect(result.motivo).toBe("new_country");
});

test("returns zero points when country is missing", async () => {
  const check = new NewCountryCheck();
  const result = await check.run({
    history: [],
    current: { country: undefined },
  });
  expect(result.pontos).toBe(0);
});

test("returns zero points for a known country", async () => {
  const check = new NewCountryCheck();
  const result = await check.run({
    history: [{ country: "BR" }],
    current: { country: "BR" },
  });
  expect(result.pontos).toBe(0);
});