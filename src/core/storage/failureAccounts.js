"use strict";

const KNOWN_FAILURE = "success = 0 AND legacy = 0 AND user_id IS NOT NULL AND ip IS NOT NULL";
const COUNT_IP_ACCOUNTS = `SELECT count(*) AS n FROM (
  SELECT 1 FROM ip_failure_accounts AS account
  WHERE account.ip = ? AND account.latest_at >= ?
    AND (account.latest_at <= ? OR EXISTS (
      SELECT 1 FROM login_attempts WHERE ${KNOWN_FAILURE}
        AND ip = account.ip AND user_id = account.user_id AND created_at BETWEEN ? AND ?
    ))
  LIMIT ?
)`;

function migrateFailureAccounts(db) {
  db.exec(`
    CREATE TABLE ip_failure_accounts (
      ip TEXT NOT NULL, user_id TEXT NOT NULL, latest_at TEXT NOT NULL, PRIMARY KEY (ip, user_id)
    ) WITHOUT ROWID;
    CREATE INDEX idx_ip_failure_latest ON ip_failure_accounts(ip, latest_at);
    CREATE INDEX idx_ip_failure_time ON login_attempts(ip, created_at) WHERE ${KNOWN_FAILURE};
    CREATE INDEX idx_ip_failure_user_time ON login_attempts(ip, user_id, created_at) WHERE ${KNOWN_FAILURE};
    DROP INDEX IF EXISTS idx_ip_failure;
    INSERT INTO ip_failure_accounts (ip, user_id, latest_at)
      SELECT ip, user_id, max(created_at) FROM login_attempts WHERE ${KNOWN_FAILURE} GROUP BY ip, user_id;
  `);
  db.exec(`
    CREATE TRIGGER ip_failure_account_insert AFTER INSERT ON login_attempts
    WHEN NEW.success = 0 AND NEW.legacy = 0 AND NEW.user_id IS NOT NULL AND NEW.ip IS NOT NULL
    BEGIN
      INSERT INTO ip_failure_accounts VALUES (NEW.ip, NEW.user_id, NEW.created_at)
      ON CONFLICT (ip, user_id) DO UPDATE SET latest_at = excluded.latest_at
        WHERE excluded.latest_at > latest_at;
    END;
    CREATE TRIGGER ip_failure_account_delete AFTER DELETE ON login_attempts
    WHEN OLD.success = 0 AND OLD.legacy = 0 AND OLD.user_id IS NOT NULL AND OLD.ip IS NOT NULL
    BEGIN
      DELETE FROM ip_failure_accounts WHERE ip = OLD.ip AND user_id = OLD.user_id AND latest_at = OLD.created_at
        AND NOT EXISTS (SELECT 1 FROM login_attempts WHERE ${KNOWN_FAILURE} AND ip = OLD.ip AND user_id = OLD.user_id);
      UPDATE ip_failure_accounts SET latest_at = (
        SELECT created_at FROM login_attempts WHERE ${KNOWN_FAILURE} AND ip = OLD.ip AND user_id = OLD.user_id
        ORDER BY created_at DESC LIMIT 1
      ) WHERE ip = OLD.ip AND user_id = OLD.user_id AND latest_at = OLD.created_at;
    END;
  `);
}

module.exports = { KNOWN_FAILURE, COUNT_IP_ACCOUNTS, migrateFailureAccounts };
