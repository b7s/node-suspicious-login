"use strict";

const { migrateFailureAccounts } = require("./failureAccounts");

const CREATE = `CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, attempt_id TEXT UNIQUE, user_id TEXT, ip TEXT,
  user_agent TEXT, country TEXT, device TEXT, latitude REAL, longitude REAL, accuracy_radius_km REAL,
  success INTEGER NOT NULL DEFAULT 0, score INTEGER NOT NULL DEFAULT 0, level TEXT NOT NULL DEFAULT 'low',
  reasons TEXT, blocked INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, legacy INTEGER NOT NULL DEFAULT 0,
  first_login INTEGER NOT NULL DEFAULT 0
)`;
const INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_user_time ON login_attempts(user_id, created_at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_created_at ON login_attempts(created_at, id);
  CREATE INDEX IF NOT EXISTS idx_eligible_time ON login_attempts(user_id, created_at DESC, id DESC)
    WHERE legacy = 0 AND success = 1 AND blocked = 0;
  CREATE INDEX IF NOT EXISTS idx_eligible_location ON login_attempts(user_id, created_at DESC, id DESC)
    WHERE legacy = 0 AND success = 1 AND blocked = 0 AND latitude IS NOT NULL AND longitude IS NOT NULL AND accuracy_radius_km IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_eligible_ip ON login_attempts(user_id, ip, created_at DESC)
    WHERE legacy = 0 AND success = 1 AND blocked = 0;
  CREATE INDEX IF NOT EXISTS idx_eligible_country ON login_attempts(user_id, country, created_at DESC)
    WHERE legacy = 0 AND success = 1 AND blocked = 0;
  CREATE INDEX IF NOT EXISTS idx_eligible_device ON login_attempts(user_id, device, created_at DESC)
    WHERE legacy = 0 AND success = 1 AND blocked = 0;
  CREATE INDEX IF NOT EXISTS idx_observed_country ON login_attempts(user_id, created_at)
    WHERE legacy = 0 AND success = 1 AND blocked = 0 AND country <> '';
  CREATE INDEX IF NOT EXISTS idx_observed_device ON login_attempts(user_id, created_at)
    WHERE legacy = 0 AND success = 1 AND blocked = 0 AND device <> '';
  CREATE INDEX IF NOT EXISTS idx_failure_account ON login_attempts(user_id, created_at DESC)
    WHERE legacy = 0 AND success = 0;
`;

function normalizeReasons(value) {
  let parsed = value;
  try {
    for (let i = 0; i < 2 && typeof parsed === "string"; i++) parsed = JSON.parse(parsed);
  } catch { return value; }
  return JSON.stringify(parsed);
}

function migrate(db, prepare) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const version = prepare("PRAGMA user_version").get().user_version;
    if (version > 2) throw new Error("Database schema is newer than this package");
    if (version < 2) upgrade(db, prepare, version);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function upgrade(db, prepare, version) {
  if (version === 0 && prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='login_attempts'").get()) {
    upgradeLegacy(db, prepare);
  }
  db.exec(CREATE);
  db.exec(INDEXES);
  migrateFailureAccounts(db);
  db.exec("PRAGMA user_version = 2");
}

function upgradeLegacy(db, prepare) {
  const columns = prepare("PRAGMA table_info(login_attempts)").all();
  if (columns.some((column) => column.name === "attempt_id")) return;
  db.exec("ALTER TABLE login_attempts RENAME TO login_attempts_legacy");
  db.exec(CREATE);
  db.exec(`INSERT INTO login_attempts (id,user_id,ip,user_agent,country,device,success,score,reasons,blocked,created_at,legacy)
    SELECT id,user_id,ip,user_agent,country,device,success,score,reasons,blocked,created_at,1 FROM login_attempts_legacy`);
  const update = prepare("UPDATE login_attempts SET reasons = ? WHERE id = ?");
  for (const row of prepare("SELECT id,reasons FROM login_attempts WHERE reasons IS NOT NULL").all()) {
    update.run(normalizeReasons(row.reasons), row.id);
  }
  db.exec("DROP TABLE login_attempts_legacy");
}

module.exports = { migrate };
