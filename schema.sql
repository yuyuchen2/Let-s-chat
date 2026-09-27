-- LetsChat D1 schema. All timestamps are Unix epoch milliseconds (Date.now()).
-- Apply this file with: npx wrangler d1 execute chat_db --remote --file=schema.sql
-- The statements are safe to re-run against a database created from this schema.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(username) BETWEEN 1 AND 50),
  password_hash TEXT NOT NULL CHECK (length(password_hash) > 0),
  failed_login_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
  locked_until INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  session_token TEXT PRIMARY KEY CHECK (length(session_token) >= 32),
  user TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT,
  user TEXT NOT NULL,
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_created_at_id ON messages (created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS online_users (
  session_token TEXT PRIMARY KEY,
  user TEXT NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_online_users_last_seen ON online_users (last_seen);
