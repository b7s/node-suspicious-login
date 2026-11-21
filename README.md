# node-suspicious-login

Score login attempts and block high-risk sign-ins before issuing a session. The package includes an Express adapter, a framework-independent API for Nest and Fastify, and transactional SQLite storage.

[Quick start](#quick-start) · [GeoLite2 City](#geolite2-city) · [Risk and actions](#risk-and-actions) · [Storage](#storage) · [Quality checks](#quality-checks)

## Quick start

The CI matrix covers Node.js 22.13.0, 22.x, 24.x, 26.x, and Bun 1.4.4. Install from GitHub's `develop` branch.

```sh
npm install github:b7s/node-suspicious-login#develop
```

Open the detector once at startup. This example uses an ES module and assumes the application supplies `authenticateCredentials` and `issueToken`.

```js
import { randomUUID } from "node:crypto";
import suspiciousLogin from "node-suspicious-login";

const { SuspiciousLogin, createMiddleware } = suspiciousLogin;
const detector = await SuspiciousLogin.open();

async function login(request) {
  const auth = await authenticateCredentials(request);
  const result = await detector.detect({
    attemptId: randomUUID(),
    userId: auth.userId ?? null,
    credentialsValid: auth.valid,
    ip: request.ip,
    userAgent: request.headers["user-agent"],
    deviceId: auth.verifiedDeviceId,
    email: auth.verifiedEmail,
  });

  if (!auth.valid) return { status: 401 };
  if (!result.allowed) return { status: 403 };
  return { status: 200, token: await issueToken(auth.userId) };
}
```

Supply a string account ID from server-side authentication, or `null` for an unknown account. Device ID and verified email are optional. Configure trusted proxies before using the framework's resolved IP. Use a unique `attemptId` per attempt and keep it stable across retries. Replays return the stored decision and skip notifications.

Allow session creation only after `allowed: true`. Handle detection errors as operational failures, for example with HTTP 503, and call `await detector.close()` at shutdown.

### Express and Nest

Use the Express adapter with a server-side authentication resolver. Nest with the Express platform can use the same adapter, or call `detect` after validating credentials.

```js
app.post("/login", createMiddleware(detector, {
  async resolveAuthentication(req) {
    const auth = await authenticateCredentials(req);
    req.authenticatedUserId = auth.userId;
    return {
      attemptId: randomUUID(),
      userId: auth.userId ?? null,
      credentialsValid: auth.valid,
      deviceId: auth.verifiedDeviceId,
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
```

The adapter returns 401 for invalid credentials, 403 for blocked logins, and forwards errors to the application's Express error handler. The decision is available as `req.suspiciousLogin`. When upgrading, replace the old `userIdField` and `successField` options with `resolveAuthentication`. [Express and Nest tests](tests/adapters/frameworks.test.js)

### Fastify and other frameworks

Use the core example in your login handler and map its result to your framework's response. Issue the session only after the detector allows the attempt. [Fastify integration test](tests/adapters/frameworks.test.js)

## GeoLite2 City

Download the free `GeoLite2-City.mmdb` database using a MaxMind account and keep it up to date. [MaxMind GeoLite2 download and setup](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data/)

```js
const detector = await SuspiciousLogin.open({
  geoLite2Path: "/data/GeoLite2-City.mmdb",
});
```

Lookups run locally. With no provider configured, scoring continues without location signals. An unreadable database fails at startup. Lookup failures and timeouts leave location unknown.

To use another service or your own IP database, pass an `ipProvider` with `lookup(ip, { signal })`. Return `null` for unknown locations or an object with an uppercase two-letter `country` code. Include `latitude`, `longitude`, and `accuracyRadiusKm` for travel scoring. Forward the abort signal to remote requests. The default timeout is 1,000 ms, configurable with `locationTimeoutMs`. Changing providers requires no history migration.

## Risk and actions

| Preset | Medium | High |
| --- | ---: | ---: |
| `defaultPreset` | 40 | 70 |
| `adminPreset` | 25 | 50 |

Both presets block high-risk attempts. Medium and high risk can send email when `actions.notify_user` is configured with `new actions.notifyUser({ transporter, from })` and the application supplies a verified email. Effects run after the decision is stored. Subscribe to `SuspiciousLoginDetected` for events and use `onEffectError` to report failures.

- Only allowed logins with valid credentials establish a baseline. The first observed device or country adds no novelty points. The default recognition window is 90 days.
- Only the highest of new IP, new country, and impossible travel counts. Travel scoring subtracts the uncertainty at both locations and requires more than 500 km at over 900 km/h.
- In the default 15-minute window, repeated failures trigger at five for one account. Credential stuffing triggers at ten failures from one IP across at least five known accounts. Only the stronger failure signal counts. Invalid credentials are logged with score zero.

Pass a `preset` to change thresholds and actions. Use `risk` for [windows and counts](src/core/config.js) and `weights` for individual signal weights, for example `{ new_ip: 5 }`. See the [environment configuration example](config/example.env) for SQLite, GeoLite2, and SMTP settings.

## Storage

SQLite uses `./suspicious-login.sqlite` by default. Set `dbPath` to change it. Opening the built-in store applies migrations and preserves legacy records for audit. Legacy records are excluded from scoring. Schedule `detector.storage.prune({ before, limit })` to clean up old records in batches.

For replicas on multiple hosts, pass a `storage` adapter backed by a shared database. Run its migrations at startup and make `withTransaction` commit decisions atomically and serialize conflicting account and IP updates. [Storage contract](src/core/storage/base.js) · [Custom adapter example](tests/storage/customAdapter.test.js) · [Transaction queries](src/core/storage/sqliteQueries.js)

## Quality checks

[CI](.github/workflows/ci.yml) runs the full Node.js test suite and Bun's storage, adapter, and scoring checks. Tests cover session issuance after risk checks, SQLite migration and persistence, replay handling, and false-positive scenarios.

| Check | Command |
| --- | --- |
| Install locked dependencies | `npm ci` |
| Tests | `npm test -- --runInBand` |
| Lint and complexity limit of 5 | `npm run lint` |
| Duplication gate at 0% in `src/` | `npm run duplication` |
| On-disk SQLite benchmark at 10k and 100k records | `node benchmarks/sqlite.js` |

The duplication gate checks blocks of at least four lines and 25 tokens.
