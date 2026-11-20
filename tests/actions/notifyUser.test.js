const NotifyUser = require("../../src/core/actions/notifyUser");

test("sends email and returns notified", async () => {
  const sendMail = jest.fn().mockResolvedValue({});
  const transporter = { sendMail };
  const action = new NotifyUser({ transporter, from: "test@test.com" });

  const result = await action.execute({
    userId: "user@example.com",
    ip: "1.2.3.4",
    country: "BR",
    score: 50,
    level: "medium",
  });

  expect(sendMail).toHaveBeenCalledTimes(1);
  expect(result.notified).toBe(true);
  expect(result.blocked).toBe(false);
});

test("returns not notified when no transporter", async () => {
  const action = new NotifyUser({});
  const result = await action.execute({ userId: "u1", ip: "1.2.3.4", score: 50, level: "high" });
  expect(result.notified).toBe(false);
  expect(result.blocked).toBe(false);
});