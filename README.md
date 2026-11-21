# node-suspicious-login

Framework-independent suspicious login scoring for Node.js 22.13+, 24 and 26, and Bun 1.4.4. An Express adapter is included; Nest on Express can use it and Fastify can call the core. SQLite is the default, while applications may supply another storage adapter.

## Installation and startup

```sh
npm install node-suspicious-login
```

Authenticate credentials **before** calling the detector, but do not issue a session, cookie or token until the detector returns `allowed: true`. Never take the account ID, authentication outcome or trusted device ID directly from an unverified client field. Configure trusted proxies in the framework before using its resolved IP.

```js
const { randomUUID } = require("crypto");
const { SuspiciousLogin } = require("node-suspicious-login");

// At application startup. GeoLite2 is optional: omit geoLite2Path to disable location.
const detector = await SuspiciousLogin.open({
  dbPath: "./suspicious-login.sqlite",
  geoLite2Path: "/data/GeoLite2-City.mmdb",
  onEffectError: (error) => logger.error(error),
});

// After your own password/MFA verification, before creating the session:
const auth = await authenticateCredentials(request); // application function
const result = await detector.detect({
  attemptId: randomUUID(), // reuse the same ID only for a retry of this attempt
  userId: auth.userId ?? null, // null for an unknown account
  credentialsValid: auth.valid,
  ip: request.ip,
  userAgent: request.headers["user-agent"],
  deviceId: auth.verifiedDeviceId, // optional opaque, persistent application identifier
  email: auth.verifiedEmail, // optional address obtained from the account
});
if (!result.allowed) return denyLogin();
return issueSession(auth.userId);

// On graceful application shutdown:
await detector.close();
```

The snippets illustrate integration points; `logger`, credential verification and session issuance belong to the application. Invalid credentials are recorded with score zero and cannot be allowed. Storage and calculation failures reject with `SuspiciousLogin.DetectionError`; handle them as an operational error without issuing a session. `attemptId` must be unique per attempt and stable across retries. A repeated ID returns the persisted decision without inserting another row or dispatching effects again. A different account or credentials result for the same ID is rejected.

## Express and Nest

Run authentication inside the resolver or earlier trusted server-side middleware. The adapter does not read identity or success flags from the request body. Route handlers after it may issue sessions only after `req.suspiciousLogin.allowed` is true.

```js
const { createMiddleware } = require("node-suspicious-login");
app.post("/login", createMiddleware(detector, {
  resolveAuthentication: async (req) => {
    const auth = await authenticateCredentials(req);
    req.authenticatedUserId = auth.userId;
    return {
      attemptId: randomUUID(), userId: auth.userId ?? null,
      credentialsValid: auth.valid, deviceId: auth.verifiedDeviceId,
      email: auth.verifiedEmail,
    };
  },
}), async (req, res, next) => {
  try {
    res.json({ token: await issueToken(req.authenticatedUserId) });
  } catch (error) {
    next(error);
  }
});

// Register an application error handler after routes. Never issue a session here.
app.use((error, req, res, next) => {
  logger.error(error);
  res.status(503).json({ error: "Login temporarily unavailable" });
});
```

Invalid credentials receive 401, blocked attempts receive a generic 403, and errors are forwarded to Express. Nest using its Express adapter can register the same middleware before the login handler, or call `detect` directly after authentication. The previous `userIdField`/`successField` middleware options have been removed: migrate by supplying `resolveAuthentication` and moving session creation after this middleware.

## Fastify and other frameworks

Call the same core after authentication and before issuing a session:

```js
fastify.post("/login", async (req, reply) => {
  const auth = await authenticateCredentials(req);
  const result = await detector.detect({
    attemptId: randomUUID(), userId: auth.userId ?? null,
    credentialsValid: auth.valid, ip: req.ip,
    userAgent: req.headers["user-agent"], deviceId: auth.verifiedDeviceId,
    email: auth.verifiedEmail,
  });
  if (!auth.valid) return reply.code(401).send({ error: "Authentication failed" });
  if (!result.allowed) return reply.code(403).send({ error: "Login denied" });
  return { token: await issueToken(auth.userId) };
});
```

Install an error handler that responds with an operational error (for example 503) and does not issue a session when `detect` throws. The same pattern works in Bun. The package does not validate credentials or issue sessions itself.

## Geolocation

GeoLite2 City is the built-in local provider when `geoLite2Path` is supplied to `SuspiciousLogin.open`. Obtain the free database from a MaxMind account, observe its terms and update it regularly. The file is not included. Initialization fails if the configured database cannot be opened. Per-IP lookup failures or timeouts leave location unknown; no online lookup is enabled by default. Configure `locationTimeoutMs` (default 1000 ms).

Alternatively pass an `ipProvider` with `async lookup(ip, { signal })`, returning `{ country, city, latitude, longitude, accuracyRadiusKm }` or `null`. Country must be an ISO uppercase two-letter code; coordinates and a non-negative accuracy radius are required for travel scoring. Services, local MMDB files or a custom IPv4/IPv6 range database can implement this interface. The detector passes an `AbortSignal` at lookup and aborts it on timeout. Forward it to remote requests so they can stop promptly. Invalid credentials and stored replays skip lookup. No history migration is required to replace the provider.

## Risk and actions

Only successful, unblocked, non-legacy logins within the last 90 days establish recognized devices, IPs and countries. The first eligible login does not receive novelty points, but recent failure signals still apply. The first observed country and the first observed device each establish a baseline without adding points, including when the relevant data was missing from earlier logins. Device IDs are provided by the application. Between new IP (10), new country (30) and impossible travel (40), only the highest score applies. Travel compares the latest eligible location with coordinates and accuracy, subtracts both uncertainty radii, and requires minimum distance greater than 500 km and speed greater than 900 km/h. A suspicious user agent adds 20 and a new device adds 25.

By default, five failures for one account in 15 minutes add 35; ten failures across at least five known accounts from one IP in 15 minutes add 40. Only the higher of these two signals applies. These are starting values; tune them against real traffic. The default preset classifies medium at 40 and high at 70; admin uses 25 and 50. High risk is blocked by the preset regardless of notification configuration.

Use `risk: { recognitionDays, failureWindowMinutes, failureThreshold, ipFailureThreshold, ipAccountThreshold }` to override positive integer windows and counts. Use `weights: { new_ip: 5, new_country: 20 }` to override individual non-negative signal weights. For thresholds or actions, pass a preset instance with `thresholds` and `actionsForLevel(level)`. Invalid settings fail at initialization.

Effects run after persistence and do not hold up the decision. Configure `actions.notify_user` with `new actions.notifyUser({ transporter, from })`, where `transporter` is a Nodemailer transport. Only a verified `email` supplied by the application is used. Configure `actions.custom_action` and its preset mapping for callbacks. Subscribe with `detector.on("SuspiciousLoginDetected", listener)`. Failures reach `onEffectError`, or a process warning by default. Effects are best effort: use an application-managed durable outbox if delivery guarantees are required.

## Storage and migration

The default database is `./suspicious-login.sqlite` (override with `dbPath`). Startup opens and migrates it; call `close()` on shutdown. Transactions use SQLite's rollback journal, `BEGIN IMMEDIATE` and a bounded busy timeout. Use one local database file only on a local filesystem; multiple hosts or replicas need a shared database through a custom adapter. Retention is not automatic: schedule `await detector.storage.prune({ before: utcIsoTimestamp, limit: 1000 })` if desired.

The migration preserves old IDs, timestamps, scores, decisions and reasons, including malformed raw reason values, and marks old records as legacy. Legacy rows remain auditable but do not establish trusted history or count toward new risk calculations because the old middleware trusted client-provided identity and success. Migration is transactional and repeatable. Back up the database before upgrading and test the migration with your own data.

A custom `storage` implements `migrate()`, `withTransaction(async tx => ...)`, `prune({before, limit})`, and `close()`; methods may be asynchronous. `withTransaction` must atomically commit or roll back the callback and serialize conflicting account/IP decisions, including across replicas. Migrations and indexes are the adapter's responsibility. Its transaction object provides:

- `decision(attemptId)` returns the stored row or null; `insert(row)` stores a row with unique `attempt_id`.
- `hasEligible(userId, since)` and `known(field, userId, value, since)` return booleans. Fields are `ip`, `country` and `device`; only valid, unblocked, non-legacy successes count. `hasObserved(field, userId, since)` reports whether any eligible login supplied a nonempty value for `country` or `device`.
- An optional storage-level `readDecision(attemptId)` may return the same committed row as `tx.decision` before a location lookup. The detector uses a transaction for this read when the adapter omits the method.
- `lastLocated(userId, since)` returns the newest eligible row with coordinates and accuracy, ordered by UTC `created_at` and ID, or null.
- `failureCount(userId, since, until, limit)`, `ipFailures(ip, since, until, limit)` and `ipAccounts(ip, since, until, limit)` return counts capped at the given limit, counting non-legacy failed attempts in the inclusive UTC window. IP counts include only known account IDs; `ipAccounts` counts distinct IDs.

Rows use the snake_case fields in `src/core/scoring/transaction.js`; `reasons` is a JSON string. Preserve decision fields on lookup. The included SQLite and memory adapters illustrate the contract. The memory adapter is for tests, not durable or shared production use.

## Verification

Run `npm test -- --runInBand`, `npm run lint`, and `npm run duplication`. The duplication gate checks blocks of at least four lines and 25 tokens in `src/` with a 0% threshold. CI runs Node 22.13, current 22/24/26 and Bun 1.4.4. Run `node benchmarks/sqlite.js` for a local on-disk 10k/100k history, one/two-connection latency, and 10k/100k recent failures against one account. Results depend on hardware and filesystem.
