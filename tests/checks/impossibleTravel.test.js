const ImpossibleTravelCheck = require("../../src/core/checks/impossibleTravel");

const recent = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
const old = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();

test("flags impossible travel within 4 hours", async () => {
  const check = new ImpossibleTravelCheck();
  const result = await check.run({
    history: [{ country: "US", created_at: recent }],
    current: { country: "BR", created_at: new Date().toISOString() },
  });
  expect(result.pontos).toBe(40);
  expect(result.motivo).toBe("impossible_travel");
});

test("allows travel after 4 hours", async () => {
  const check = new ImpossibleTravelCheck();
  const result = await check.run({
    history: [{ country: "US", created_at: old }],
    current: { country: "BR" },
  });
  expect(result.pontos).toBe(0);
});

test("returns zero when countries match", async () => {
  const check = new ImpossibleTravelCheck();
  const result = await check.run({
    history: [{ country: "US", created_at: recent }],
    current: { country: "US" },
  });
  expect(result.pontos).toBe(0);
});

test("returns zero when no history", async () => {
  const check = new ImpossibleTravelCheck();
  const result = await check.run({
    history: [],
    current: { country: "BR" },
  });
  expect(result.pontos).toBe(0);
});