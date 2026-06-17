CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC);

CREATE TABLE IF NOT EXISTS online_users (
  user TEXT PRIMARY KEY,
  last_seen INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_online_users_last_seen ON online_users (last_seen DESC);
