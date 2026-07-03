-- Sessions: 用于服务器颁发并验证 session token（用于登录认证）
CREATE TABLE IF NOT EXISTS sessions (
  session_token TEXT PRIMARY KEY,
  user TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

-- Messages: 每条消息记录所属 session_token 及显示名（user）
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT,
  user TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC);

-- Online users: 使用 session_token 作为主键（同一用户名可由不同 session 区分）
CREATE TABLE IF NOT EXISTS online_users (
  session_token TEXT PRIMARY KEY,
  user TEXT NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_online_users_last_seen ON online_users (last_seen DESC);
