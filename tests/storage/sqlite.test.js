"use strict";

const { mkdtempSync, rmSync } = require("fs");
const { tmpdir } = require("os");
const { join } = require("path");
const { DatabaseSync } = require("node:sqlite");
const SqliteStorage = require("../../src/core/storage/sqlite");
const { COUNT_IP_ACCOUNTS, KNOWN_FAILURE } = require("../../src/core/storage/failureAccounts");

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "suspicious-login-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

test("migrates legacy records and preserves them across reopen", async () => {
  const path = join(dir, "test.sqlite");
  const old = new DatabaseSync(path);
  old.exec(`CREATE TABLE login_attempts (id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, ip TEXT NOT NULL,
    user_agent TEXT, country TEXT, device TEXT, success INTEGER, score INTEGER, reasons TEXT, blocked INTEGER, created_at TEXT)`);
  old.prepare("INSERT INTO login_attempts VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .run(7, "u", "1", "ua", "BR", "device", 1, 10, JSON.stringify(JSON.stringify(["legacy"])), 0, "2025-01-01T00:00:00.000Z");
  old.close();
  const db = new SqliteStorage(path);
  db.migrate();
  expect(db.listByUser("u")[0]).toMatchObject({ id: 7, reasons: ["legacy"], legacy: 1 });
  await db.create({ user_id: "u", ip: "2", success: true });
  await db.close();
  const reopened = new SqliteStorage(path);
  expect(reopened.listByUser("u")).toHaveLength(2);
  expect(await reopened.withTransaction((tx) => tx.hasEligible("u", "2020"))).toBe(true);
  await reopened.close();
});

test("migration rolls back the original table on failure", () => {
  const { migrate } = require("../../src/core/storage/schema");
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE login_attempts (id INTEGER PRIMARY KEY, user_id TEXT, ip TEXT, user_agent TEXT,
    country TEXT, device TEXT, success INTEGER, score INTEGER, reasons TEXT, blocked INTEGER, created_at TEXT)`);
  db.exec("INSERT INTO login_attempts VALUES (1,'u','ip',NULL,NULL,NULL,1,0,'[]',0,'2020-01-01')");
  const prepare = (sql) => {
    if (sql.startsWith("SELECT id,reasons")) throw new Error("migration failure");
    return db.prepare(sql);
  };
  expect(() => migrate(db, prepare)).toThrow("migration failure");
  expect(db.prepare("SELECT id, user_id FROM login_attempts").get()).toMatchObject({ id: 1, user_id: "u" });
  expect(db.prepare("SELECT name FROM sqlite_master WHERE name='login_attempts_legacy'").get()).toBeUndefined();
  db.close();
});

test("critical evidence queries use indexes", async () => {
  const db = new SqliteStorage(":memory:");
  const queries = [
    ["SELECT 1 FROM login_attempts WHERE user_id=? AND created_at>=? AND legacy=0 AND success=1 AND blocked=0 LIMIT 1", ["u", "2020"]],
    ["SELECT 1 FROM login_attempts WHERE user_id=? AND created_at>=? AND legacy=0 AND success=1 AND blocked=0 AND device=? LIMIT 1", ["u", "2020", "d"]],
    [`SELECT 1 FROM login_attempts WHERE ${KNOWN_FAILURE} AND ip = ? AND created_at BETWEEN ? AND ? LIMIT 10`, ["ip", "2020", "2030"]],
    [COUNT_IP_ACCOUNTS, ["ip", "2020", "2030", "2020", "2030", 5]],
  ];
  for (const [query, params] of queries) {
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${query}`).all(...params).map((row) => row.detail).join(" ");
    expect(plan).toMatch(/USING (?:COVERING )?INDEX/);
    expect(plan).not.toMatch(/TEMP B-TREE/);
  }
  await db.close();
});

test("rolls back failed transactions and preserves writes from two connections", async () => {
  const path = join(dir, "shared.sqlite");
  const a = new SqliteStorage(path), b = new SqliteStorage(path);
  await expect(a.withTransaction(() => { throw new Error("abort"); })).rejects.toThrow("abort");
  await Promise.all([a.create({ user_id: "u", ip: "ip", success: false }), b.create({ user_id: "u", ip: "ip", success: false }),
    b.create({ user_id: "other", ip: "ip", success: false })]);
  expect(a.listByUser("u")).toHaveLength(2);
  expect(await a.withTransaction((tx) => tx.ipAccounts("ip", "2020", "9999", 5))).toBe(2);
  await a.close(); await b.close();
});

test("counts distinct failed accounts exactly after migration, rollback and pruning", async () => {
  const path = join(dir, "summary.sqlite");
  const original = new SqliteStorage(path);
  const countFrom = "2026-01-01T00:00:00.000Z", countUntil = "2026-01-01T00:15:00.000Z";
  const future = "2026-01-01T00:15:00.001Z";
  const add = (db, userId, timestamp) => db.create({ ip: "ip", user_id: userId, created_at: timestamp });
  await add(original, "future-only", future);
  await add(original, "a", future);
  await add(original, "a", countFrom);
  await add(original, "a", countFrom);
  await add(original, "b", countFrom);
  await add(original, "stale", "2025-12-31T23:59:59.999Z");
  await add(original, null, countFrom);
  original.db.exec(`
    DROP TRIGGER ip_failure_account_insert;
    DROP TRIGGER ip_failure_account_delete;
    DROP TABLE ip_failure_accounts;
    DROP INDEX idx_ip_failure_time;
    DROP INDEX idx_ip_failure_user_time;
    PRAGMA user_version = 1
  `);
  await original.close();

  const db = new SqliteStorage(path);
  const count = (limit = 5) => db.withTransaction((tx) => tx.ipAccounts("ip", countFrom, countUntil, limit));
  expect(await count()).toBe(2);
  expect(await count(1)).toBe(1);
  await expect(db.withTransaction((tx) => {
    tx.insert({ attempt_id: "rollback", user_id: "rollback", ip: "ip", success: 0, legacy: 0,
      score: 0, level: "low", blocked: 0, first_login: 0, created_at: countUntil });
    throw new Error("abort");
  })).rejects.toThrow("abort");
  expect(await count()).toBe(2);
  await add(db, "boundary", countUntil);
  expect(await count()).toBe(3);
  await db.prune({ before: countUntil, limit: 2 });
  expect(await count()).toBe(3);
  await db.prune({ before: countUntil, limit: 10 });
  expect(await count()).toBe(1);
  await db.prune({ before: "2026-01-01T00:16:00.000Z", limit: 10 });
  expect(db.prepare("SELECT count(*) AS n FROM ip_failure_accounts").get().n).toBe(0);
  await db.close();
});
