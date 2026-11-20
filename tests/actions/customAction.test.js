const CustomAction = require("../../src/core/actions/customAction");

test("runs custom handler and returns outcome", async () => {
  const handler = jest.fn().mockResolvedValue({ blocked: true, notified: true });
  const action = new CustomAction(handler);
  const result = await action.execute({ userId: "u1" });
  expect(handler).toHaveBeenCalledWith({ userId: "u1" });
  expect(result.blocked).toBe(true);
  expect(result.notified).toBe(true);
});

test("defaults to not blocked/notified when handler returns nothing", async () => {
  const action = new CustomAction(async () => {});
  const result = await action.execute({});
  expect(result.blocked).toBe(false);
  expect(result.notified).toBe(false);
});