"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { performance } = require("perf_hooks");
const SuspiciousLogin = require("../src/core/SuspiciousLogin");
const SqliteStorage = require("../src/core/storage/sqlite");
const { COUNT_IP_ACCOUNTS } = require("../src/core/storage/failureAccounts");

function seed(storage, count) {
  storage.db.exec(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n < ${count})
    INSERT INTO login_attempts (attempt_id,user_id,ip,success,score,level,reasons,blocked,created_at,legacy)
    SELECT 'old-'||n,'u','old-ip',1,0,'low','[]',0,'2020-01-01T00:00:00.000Z',0 FROM seq`);
}
function percentiles(samples) {
  samples.sort((a, b) => a - b);
  return { p50_ms: +samples[Math.floor(samples.length * .5)].toFixed(3),
    p95_ms: +samples[Math.floor(samples.length * .95)].toFixed(3), max_ms: +samples.at(-1).toFixed(3) };
}
async function measure(detectors, count) {
  const samples = [];
  async function worker(index) {
    for (let i = index; i < count; i += detectors.length) {
      const start = performance.now();
      await detectors[index].detect({ attemptId: `run-${detectors.length}-${i}`, userId: "u", credentialsValid: true, ip: "ip" });
      samples.push(performance.now() - start);
    }
  }
  await Promise.all(detectors.map((_, index) => worker(index)));
  return percentiles(samples);
}
async function measureRecentFailures(storage, count) {
  const since = new Date(Date.now() - 900000).toISOString();
  const until = new Date().toISOString();
  storage.prepare(`WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n < ?)
    INSERT INTO login_attempts (attempt_id,user_id,ip,created_at)
    SELECT 'failure-'||n,'target','ip',? FROM seq`).run(count, until);
  const samples = [];
  await storage.withTransaction((tx) => {
    for (let i = 0; i < 1000; i++) {
      const start = performance.now();
      const accounts = tx.ipAccounts("ip", since, until, 5);
      samples.push(performance.now() - start);
      if (accounts !== 1) throw new Error(`Expected one distinct account, got ${accounts}`);
    }
  });
  const plan = storage.prepare(`EXPLAIN QUERY PLAN ${COUNT_IP_ACCOUNTS}`).all("ip", since, until, since, until, 5);
  return { rows: count, distinct_account_lookup: percentiles(samples), plan: plan.map((row) => row.detail) };
}
async function run(count) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "suspicious-bench-"));
  const dbPath = path.join(dir, "test.sqlite");
  const a = new SqliteStorage(dbPath);
  seed(a, count);
  const b = new SqliteStorage(dbPath);
  const first = new SuspiciousLogin({ storage: a }), second = new SuspiciousLogin({ storage: b });
  try {
    const recentFailures = await measureRecentFailures(a, count);
    const single = await measure([first], 100);
    const concurrent = await measure([first, second], 100);
    const plan = a.prepare("EXPLAIN QUERY PLAN SELECT 1 FROM login_attempts WHERE user_id=? AND created_at>=? AND legacy=0 AND success=1 AND blocked=0 AND ip=? LIMIT 1").all("u", "2026", "ip");
    return { historical_rows: count, recent_failures: recentFailures,
      single_connection: single, two_connections: concurrent, plan: plan.map((row) => row.detail) };
  } finally {
    await first.close(); await second.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
(async () => { for (const count of [10000, 100000]) console.log(JSON.stringify(await run(count))); })().catch((error) => { console.error(error); process.exitCode = 1; });
